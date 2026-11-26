import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { comfyGenerate, comfyHealth } from "../comfy-client";
import { GENERATORS } from "../generators";
import { renderSizeForCanvas } from "../render-sizes";
import { createAsk, createConcepts, headlineOf, reviewFlyer, reviseConcept, type Ask } from "./director";
import { backgroundJpeg, cleanObject, fitForPublishing, prepareLogo, reviewCopy, type LogoVariants } from "./images";
import type { FlyerRenderMode } from "./export-script";
import { parseMeasurements, type FlyerExport } from "./flyer-layers";
import { dumpRenderedDom, renderHtml } from "./render";
import { flyerFile, mutateJobs, readFlyerFile, readJobs, saveFlyerFile, updateJob } from "./store";
import { buildFlyerHtml, findTemplate } from "./templates";
import { buildTheme, displayFont } from "./theme";
import { FLYER_SIZES, type Flyer, type FlyerBrand, type FlyerConcept, type FlyerFormat, type FlyerJob, type FlyerReview } from "./types";

const MAX_REVIEW_ROUNDS = 2;
const MAX_OBJECT_ATTEMPTS = 3;
const MAX_USED_HEADLINES = 30;

/** Dependencias externas, reemplazables en tests. */
export interface FlyerEngine {
  ask: Ask;
  canSee: boolean;
  makeAsset: (concept: FlyerConcept, format: FlyerFormat) => Promise<Buffer>;
  render: (html: string, width: number, height: number) => Promise<Buffer>;
}

async function makeAsset(concept: FlyerConcept, format: FlyerFormat): Promise<Buffer> {
  const template = findTemplate(concept.template);
  if (!template?.asset || !concept.assetPrompt) throw new Error("El diseño no pide un recurso visual.");
  if (!(await comfyHealth())) throw new Error("ComfyUI está apagado. Encendelo desde el panel para generar la imagen.");
  const prompt = `${concept.assetPrompt}, ${template.assetGuide}`;

  if (template.asset === "foto") {
    const generator = GENERATORS["flux-2-klein"];
    const size = renderSizeForCanvas(FLYER_SIZES[format].width, FLYER_SIZES[format].height);
    const result = await comfyGenerate(
      generator.buildWorkflow(prompt, { ...generator.defaultParams, ...size, upscale: "ultrasharp" }, ""),
      "flux-2-klein",
    );
    return Buffer.from(result.image.split(",")[1], "base64");
  }

  const generator = GENERATORS["qwen-image-2.1"];
  for (let attempt = 0; attempt < MAX_OBJECT_ATTEMPTS; attempt += 1) {
    const result = await comfyGenerate(
      generator.buildWorkflow(prompt, { ...generator.defaultParams, width: 1024, height: 1152, steps: 30, transparent: 1 }, ""),
      "qwen-image-2.1",
    );
    const clean = await cleanObject(Buffer.from(result.image.split(",")[1], "base64"));
    if (clean) return clean;
  }
  throw new Error("El modelo no logró recortar el objeto.");
}

export function createEngine(model: string): FlyerEngine {
  return { ...createAsk(model), makeAsset, render: (html, width, height) => renderHtml(html, width, height) };
}

function flyerHtml(
  flyer: Pick<Flyer, "id" | "hasAsset">,
  concept: FlyerConcept,
  format: FlyerFormat,
  brand: FlyerBrand,
  logo: LogoVariants | null,
  mode: FlyerRenderMode = "normal",
): string {
  const template = findTemplate(concept.template);
  if (!template) throw new Error("El diseño ya no está disponible.");
  const theme = buildTheme(brand, concept.tone);
  const { width, height } = FLYER_SIZES[format];
  return buildFlyerHtml(
    template,
    {
      slots: concept.slots,
      theme,
      width,
      height,
      brandName: brand.name,
      website: brand.website.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, ""),
      logoUrl: logo ? (theme.dark ? logo.light : logo.dark) : null,
      logoLightUrl: logo?.light || null,
      logoDarkUrl: logo?.dark || null,
      assetUrl: flyer.hasAsset ? pathToFileURL(flyerFile(flyer.id, "recurso")).href : null,
    },
    displayFont(brand.headingFont),
    mode,
  );
}

async function drawFlyer(
  flyer: Pick<Flyer, "id" | "hasAsset">,
  concept: FlyerConcept,
  format: FlyerFormat,
  brand: FlyerBrand,
  logo: LogoVariants | null,
  engine: FlyerEngine,
): Promise<Buffer> {
  const { width, height } = FLYER_SIZES[format];
  return engine.render(flyerHtml(flyer, concept, format, brand, logo), width, height);
}

/** Separa un flyer en fondo y capas editables, para abrirlo en el editor. */
export async function exportFlyer(jobId: string, flyerId: string, brand: FlyerBrand): Promise<FlyerExport> {
  const flyer = readJobs()
    .find((item) => item.id === jobId)
    ?.flyers.find((item) => item.id === flyerId);
  if (!flyer || !flyer.revision) throw new Error("Ese flyer todavía no está listo.");
  const { width, height } = FLYER_SIZES[flyer.format];
  const logo = await prepareLogo(brand.logoDataUrl);
  const dom = await dumpRenderedDom(flyerHtml(flyer, flyer.concept, flyer.format, brand, logo, "layers"), width, height);
  const encoded = /data-layers="([A-Za-z0-9+/=]+)"/.exec(dom)?.[1];
  if (!encoded) throw new Error("No se pudieron medir los textos del flyer.");
  const background = await renderHtml(flyerHtml(flyer, flyer.concept, flyer.format, brand, logo, "background"), width, height);
  return {
    ...parseMeasurements(encoded),
    format: flyer.format,
    width,
    height,
    background: `data:image/jpeg;base64,${(await backgroundJpeg(background)).toString("base64")}`,
  };
}

interface Produced {
  concept: FlyerConcept;
  review?: FlyerReview;
  image: Buffer;
}

/** Genera el recurso, dibuja y corrige hasta que el revisor aprueba. Se queda con la mejor versión. */
export async function produceFlyer(
  flyer: Flyer,
  brand: FlyerBrand,
  brief: string,
  logo: LogoVariants | null,
  engine: FlyerEngine,
  onStep: (step: string) => Promise<void> = async () => {},
): Promise<Produced> {
  const name = findTemplate(flyer.concept.template)?.name || "Flyer";
  let concept = flyer.concept;
  if (flyer.hasAsset) {
    await onStep(`${name}: generando la imagen`);
    saveFlyerFile(flyer.id, "recurso", await engine.makeAsset(concept, flyer.format));
  }
  await onStep(`${name}: armando el diseño`);
  let image = await drawFlyer(flyer, concept, flyer.format, brand, logo, engine);
  if (!engine.canSee) return { concept, image };

  let best: Produced = { concept, image };
  for (let round = 0; round <= MAX_REVIEW_ROUNDS; round += 1) {
    await onStep(`${name}: revisión ${round + 1}`);
    let result: Awaited<ReturnType<typeof reviewFlyer>>;
    try {
      result = await reviewFlyer(concept, brief, await reviewCopy(image), engine.ask);
    } catch (error) {
      console.warn("[Flyers] Falló la revisión:", error instanceof Error ? error.message : error);
      break;
    }
    if (!best.review || result.review.score > best.review.score) {
      best = { concept, review: result.review, image };
      if (flyer.hasAsset) bestAsset.set(flyer.id, readFlyerFile(flyer.id, "recurso"));
    }
    if (!result.next || round === MAX_REVIEW_ROUNDS) break;
    concept = result.next;
    if (flyer.hasAsset && result.redoAsset) {
      await onStep(`${name}: rehaciendo la imagen`);
      saveFlyerFile(flyer.id, "recurso", await engine.makeAsset(concept, flyer.format));
    }
    image = await drawFlyer(flyer, concept, flyer.format, brand, logo, engine);
  }
  // El recurso guardado debe ser el de la versión elegida.
  const asset = bestAsset.get(flyer.id);
  if (asset) saveFlyerFile(flyer.id, "recurso", asset);
  bestAsset.delete(flyer.id);
  return best;
}
const bestAsset = new Map<string, Buffer | null>();

const worker = globalThis as typeof globalThis & { saasFlyerBusy?: boolean };

/** Un trabajo por vez: comparten la GPU y ComfyUI. */
async function exclusive<T>(action: () => Promise<T>): Promise<T> {
  if (worker.saasFlyerBusy) throw new Error("Ya hay flyers en preparación. Esperá a que terminen.");
  worker.saasFlyerBusy = true;
  try {
    return await action();
  } finally {
    worker.saasFlyerBusy = false;
  }
}

function setFlyer(job: FlyerJob, id: string, change: Partial<Flyer>): FlyerJob {
  return { ...job, flyers: job.flyers.map((flyer) => (flyer.id === id ? { ...flyer, ...change } : flyer)) };
}

async function finishFlyer(jobId: string, flyer: Flyer, produced: Produced): Promise<void> {
  saveFlyerFile(flyer.id, "imagen", await fitForPublishing(produced.image));
  await updateJob(jobId, (job) =>
    setFlyer(job, flyer.id, { concept: produced.concept, review: produced.review, revision: flyer.revision + 1, error: undefined }),
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar el flyer.";
}

async function runJob(job: FlyerJob, brand: FlyerBrand, engine: FlyerEngine): Promise<void> {
  const step = (text: string) => updateJob(job.id, (current) => ({ ...current, step: text }));
  try {
    const previous = readJobs().filter((item) => item.brandId === brand.id && item.id !== job.id);
    const history = {
      headlines: previous.flatMap((item) => item.flyers.map((flyer) => headlineOf(flyer.concept))).filter(Boolean).slice(0, MAX_USED_HEADLINES),
      // Para variar: los sistemas del último pedido con resultados.
      templates: previous.find((item) => item.flyers.length)?.flyers.map((flyer) => flyer.concept.template) || [],
    };
    const concepts = await createConcepts(brand, job.brief, engine.ask, history);
    const flyers: Flyer[] = concepts.map((concept) => ({
      id: randomUUID(),
      concept,
      format: job.format,
      hasAsset: Boolean(findTemplate(concept.template)?.asset),
      revision: 0,
    }));
    await updateJob(job.id, (current) => ({ ...current, flyers }));
    const logo = await prepareLogo(brand.logoDataUrl);
    // Primero los que no usan la GPU: se ven enseguida.
    for (const flyer of [...flyers].sort((a, b) => Number(a.hasAsset) - Number(b.hasAsset))) {
      try {
        await finishFlyer(job.id, flyer, await produceFlyer(flyer, brand, job.brief, logo, engine, step));
      } catch (error) {
        console.error("[Flyers]", message(error));
        await updateJob(job.id, (current) => setFlyer(current, flyer.id, { error: message(error) }));
      }
    }
    await updateJob(job.id, (current) => ({ ...current, status: "done", step: "" }));
  } catch (error) {
    console.error("[Flyers]", message(error));
    await updateJob(job.id, (current) => ({ ...current, status: "failed", step: "", error: message(error) }));
  }
}

export interface StartFlyerJob {
  brand: FlyerBrand;
  brief: string;
  format: FlyerFormat;
  model: string;
}

/** Crea el trabajo y lo ejecuta en segundo plano. */
export async function startFlyerJob(input: StartFlyerJob, engine = createEngine(input.model)): Promise<{ job: FlyerJob; done: Promise<void> }> {
  if (worker.saasFlyerBusy) throw new Error("Ya hay flyers en preparación. Esperá a que terminen.");
  const job: FlyerJob = {
    id: randomUUID(),
    brandId: input.brand.id,
    brief: input.brief,
    format: input.format,
    model: input.model,
    status: "running",
    step: "Pensando conceptos",
    createdAt: new Date().toISOString(),
    flyers: [],
  };
  await mutateJobs((jobs) => ({ jobs: [job, ...jobs], result: undefined }));
  const done = exclusive(() => runJob(job, input.brand, engine)).catch((error) =>
    updateJob(job.id, (current) => ({ ...current, status: "failed", step: "", error: message(error) })),
  );
  return { job, done };
}

/** Ajusta un flyer con una instrucción en palabras del usuario. */
export async function reviseFlyer(jobId: string, flyerId: string, instruction: string, brand: FlyerBrand, model: string, engine = createEngine(model)): Promise<FlyerJob> {
  const job = readJobs().find((item) => item.id === jobId);
  const flyer = job?.flyers.find((item) => item.id === flyerId);
  if (!job || !flyer) throw new Error("No encontramos ese flyer.");
  return exclusive(async () => {
    const current = readFlyerFile(flyer.id, "imagen");
    const concept = await reviseConcept(flyer.concept, job.brief, instruction, current && engine.canSee ? await reviewCopy(current) : undefined, engine.ask);
    const logo = await prepareLogo(brand.logoDataUrl);
    if (flyer.hasAsset && concept.assetPrompt !== flyer.concept.assetPrompt)
      saveFlyerFile(flyer.id, "recurso", await engine.makeAsset(concept, flyer.format));
    const image = await drawFlyer(flyer, concept, flyer.format, brand, logo, engine);
    await finishFlyer(jobId, { ...flyer, concept }, { concept, image });
    return readJobs().find((item) => item.id === jobId)!;
  });
}

/** Un trabajo que quedó "en curso" tras reiniciar el panel ya no está corriendo. */
export function visibleJobs(brandId?: string): FlyerJob[] {
  return readJobs()
    .filter((job) => !brandId || job.brandId === brandId)
    .map((job) =>
      job.status === "running" && !worker.saasFlyerBusy
        ? { ...job, status: job.flyers.some((flyer) => flyer.revision > 0) ? ("done" as const) : ("failed" as const), step: "", error: job.error || "Se interrumpió la preparación." }
        : job,
    );
}
