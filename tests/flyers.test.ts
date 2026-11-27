import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import sharp from "sharp";

import type { FlyerEngine } from "../src/lib/flyers/pipeline";
import { buildFlyerHtml, findTemplate, FLYER_TEMPLATES } from "../src/lib/flyers/templates";
import { buildTheme, contrast, displayFont, fontUrl } from "../src/lib/flyers/theme";
import { FLYER_SIZES, FLYER_TONES, type FlyerBrand, type FlyerConcept } from "../src/lib/flyers/types";
import { parseJsonObject, validateConcept } from "../src/lib/flyers/validate";
import { applyChanges, buildDirectorPrompt, createConcepts, headlineOf } from "../src/lib/flyers/director";
import { cleanObject, fitForPublishing, prepareLogo } from "../src/lib/flyers/images";
import { FLYER_SAMPLES } from "./flyer-samples";

const BRAND: FlyerBrand = {
  id: "marca",
  name: "Marca",
  website: "https://www.marca.com.ar/",
  description: "Software a medida",
  audience: "pymes",
  valueProposition: "orden",
  voice: "directa",
  primary: "#3498db",
  accent: "#2ecc71",
  headingFont: "Montserrat",
};

function html(concept: FlyerConcept): string {
  return buildFlyerHtml(
    findTemplate(concept.template)!,
    {
      slots: concept.slots,
      theme: buildTheme(BRAND, concept.tone),
      ...FLYER_SIZES["4:5"],
      brandName: BRAND.name,
      website: "marca.com.ar",
      logoUrl: null,
      logoLightUrl: null,
      logoDarkUrl: null,
      assetUrl: null,
    },
    "Inter Tight",
  );
}

/* ---------- Diseños ---------- */

test("hay un ejemplo válido por sistema de diseño", () => {
  assert.deepEqual(FLYER_SAMPLES.map((item) => item.template).sort(), FLYER_TEMPLATES.map((item) => item.id).sort());
  for (const concept of FLYER_SAMPLES) {
    const result = validateConcept(concept);
    assert.ok(result.ok, `${concept.template}: ${result.ok ? "" : result.errors.join(" ")}`);
  }
});

test("ningún texto puede inyectar código en el diseño", () => {
  const attack = `</h1><img src=x onerror=alert(1)>"'&`;
  for (const concept of FLYER_SAMPLES) {
    const poison = (value: unknown): unknown => (Array.isArray(value) ? value.map(poison) : attack);
    const slots = Object.fromEntries(Object.entries(concept.slots).map(([key, value]) => [key, poison(value)])) as FlyerConcept["slots"];
    const page = html({ ...concept, slots });
    assert.doesNotMatch(page, /<img src=x/, concept.template);
    assert.doesNotMatch(page, /<\/h1><img/, concept.template);
  }
});

test("el documento solo puede cargar fuentes e imágenes locales", () => {
  const page = html(FLYER_SAMPLES[0]);
  assert.match(page, /default-src 'none'/);
  assert.match(page, /img-src file: data:;/);
});

/* ---------- Tema ---------- */

test("el texto se lee en todos los tonos, también con colores difíciles", () => {
  const brands = [
    ["#3498db", "#2ecc71"],
    ["#000000", "#ec4899"],
    ["#0f172a", "#94a3b8"],
    ["#ffffff", "#ffff00"],
    ["#ff0000", "#00ffff"],
    ["invalido", ""],
  ];
  for (const [primary, accent] of brands)
    for (const tone of FLYER_TONES) {
      const theme = buildTheme({ primary, accent }, tone);
      assert.ok(contrast(theme.fg, theme.bg) >= 4.5, `${primary}/${accent} ${tone}: ${contrast(theme.fg, theme.bg).toFixed(1)}`);
      assert.ok(contrast(theme.onAccent, theme.accent) >= 4.5, `${primary}/${accent} acento`);
    }
});

test("usa la fuente de la marca solo si está disponible", () => {
  assert.equal(displayFont("Playfair Display"), "Playfair Display");
  assert.equal(displayFont("Montserrat"), "Inter Tight");
  assert.match(fontUrl("Playfair Display"), /Playfair\+Display.*Inter\+Tight/);
});

/* ---------- Validación ---------- */

test("rechaza diseños inexistentes, campos faltantes y textos largos", () => {
  assert.equal(validateConcept({ template: "inventado" }).ok, false);
  assert.equal(validateConcept(null).ok, false);
  const base = FLYER_SAMPLES.find((item) => item.template === "red")!;
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ titular: "" }, /titular: falta/],
    [{ titular: "x".repeat(80) }, /máximo 34/],
    [{ nodos: ["uno"] }, /nodos: 1 elementos, deben ser 5/],
    [{ nodos: "texto" }, /debe ser una lista/],
  ];
  for (const [change, expected] of cases) {
    const result = validateConcept({ ...base, slots: { ...base.slots, ...change } });
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.errors.join(" "), expected);
  }
});

test("descarta campos ajenos, exige el recurso y ajusta tonos no admitidos", () => {
  const photo = FLYER_SAMPLES.find((item) => item.template === "foto")!;
  const result = validateConcept({ ...photo, tone: "acento", slots: { ...photo.slots, extra: "x" } });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal("extra" in result.value.slots, false);
    assert.equal(result.value.tone, "oscuro");
  }
  assert.equal(validateConcept({ ...photo, assetPrompt: "" }).ok, false);
});

test("lee el JSON aunque venga rodeado de texto", () => {
  assert.deepEqual(parseJsonObject('Va:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => parseJsonObject("nada"), /no devolvió un JSON/);
});

/* ---------- Director ---------- */

test("el director conoce la marca, los sistemas y lo prohibido", () => {
  const prompt = buildDirectorPrompt(BRAND);
  for (const template of FLYER_TEMPLATES) assert.ok(prompt.includes(`- ${template.id}:`));
  assert.match(prompt, /Software a medida/);
  assert.match(prompt, /Inventar cifras/);
});

test("pide corregir solo los conceptos que no cumplen", async () => {
  const [a, b, c, d] = FLYER_SAMPLES;
  const asked: string[] = [];
  const answers = [JSON.stringify({ concepts: [a, b, { ...c, slots: {} }, b] }), JSON.stringify({ concepts: [c, d] })];
  const concepts = await createConcepts(BRAND, "pedido", async (_system, user) => {
    asked.push(user);
    return answers.shift()!;
  });
  assert.deepEqual(concepts.map((item) => item.template), [a, b, c, d].map((item) => item.template));
  assert.equal(asked.length, 2);
  assert.match(asked[1], /Devolvé 2 conceptos nuevos/);
  assert.match(asked[1], /sistema repetido/);
});

test("evita los titulares y varía los sistemas que la marca ya usó", async () => {
  const asked: string[] = [];
  await createConcepts(
    BRAND,
    "pedido",
    async (_system, user) => {
      asked.push(user);
      return JSON.stringify({ concepts: FLYER_SAMPLES.slice(0, 4) });
    },
    { headlines: FLYER_SAMPLES.map(headlineOf), templates: ["planilla", "chat"] },
  );
  assert.match(asked[0], /usó estos sistemas: planilla, chat/);
  assert.match(asked[0], /YA USADOS[\s\S]*Esto no es un sistema[\s\S]*Si no existe, lo hacemos\./);
});

test("si nada es válido, lo dice", async () => {
  await assert.rejects(createConcepts(BRAND, "pedido", async () => '{"concepts":[]}'), /no logró proponer conceptos/);
});

test("si el cliente pide un diseño, el director usa solo ese y puede repetirlo", async () => {
  const prompt = buildDirectorPrompt(BRAND, ["chat"]);
  assert.match(prompt, /el cliente pidió solo estos/);
  assert.doesNotMatch(prompt, /- planilla:/);
  assert.match(prompt, /podés repetir sistema \(hasta 4 veces cada uno\)/);
  const chat = FLYER_SAMPLES.find((sample) => sample.template === "chat")!;
  const planilla = FLYER_SAMPLES.find((sample) => sample.template === "planilla")!;
  const answers = [
    JSON.stringify({ concepts: [chat, chat, planilla] }),
    JSON.stringify({ concepts: [chat, chat] }),
  ];
  const prompts: string[] = [];
  const concepts = await createConcepts(BRAND, "pedido", async (_system, user) => {
    prompts.push(user);
    return answers.shift()!;
  }, undefined, ["chat"]);
  assert.equal(concepts.length, 4);
  assert.ok(concepts.every((concept) => concept.template === "chat"));
  assert.match(prompts[1], /planilla: no está entre los sistemas pedidos/);
});

test("un ajuste inválido no rompe el flyer", () => {
  const concept = FLYER_SAMPLES.find((item) => item.template === "red")!;
  assert.equal(applyChanges(concept, { slots: { titular: "x".repeat(200) } }), null);
  assert.equal(applyChanges(concept, {}), null);
  assert.equal(applyChanges(concept, { tone: "oscuro" })?.tone, "oscuro");
  assert.equal(applyChanges(concept, { slots: { centro: "Acá" } })?.slots.centro, "Acá");
});

/* ---------- Imágenes ---------- */

async function pixels(width: number, height: number, alpha: (x: number, y: number) => number): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 4, 60);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data[(y * width + x) * 4 + 3] = alpha(x, y);
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

test("recorta el objeto y descarta los vacíos o sin recortar", async () => {
  assert.equal(await cleanObject(await pixels(40, 40, () => 4)), null);
  assert.equal(await cleanObject(await pixels(40, 40, () => 255)), null);
  const object = await cleanObject(await pixels(40, 40, (x, y) => (x >= 10 && x < 30 && y >= 10 && y < 20 ? 255 : 6)));
  const meta = await sharp(object!).metadata();
  assert.deepEqual([meta.width, meta.height], [20, 10]);
});

test("el logo sale sin margen y con versión blanca", async () => {
  const png = await pixels(60, 60, (x, y) => (Math.hypot(x - 30, y - 30) < 12 ? 255 : 0));
  const logo = await prepareLogo(`data:image/png;base64,${png.toString("base64")}`);
  assert.ok(logo);
  const light = Buffer.from(logo!.light.split(",")[1], "base64");
  const { data, info } = await sharp(light).raw().toBuffer({ resolveWithObject: true });
  const middle = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4;
  assert.deepEqual([...data.subarray(middle, middle + 3)], [255, 255, 255]);
  assert.equal(await prepareLogo(undefined), null);
  assert.equal(await prepareLogo("data:image/png;base64,AAAA"), null);
});

test("achica un PNG que no se podría publicar", async () => {
  const noise = Buffer.alloc(1400 * 1400 * 3);
  for (let index = 0; index < noise.length; index += 1) noise[index] = (index * 7919) % 251;
  const png = await sharp(noise, { raw: { width: 1400, height: 1400, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  const fitted = await fitForPublishing(png, 2_000_000);
  assert.ok(fitted.length < png.length);
});

/* ---------- Trabajos ---------- */

const previousDirectory = process.cwd();
const directory = mkdtempSync(path.join(os.tmpdir(), "hub-flyers-"));
let pipeline: typeof import("../src/lib/flyers/pipeline");
let store: typeof import("../src/lib/flyers/store");
let tinyPng: Buffer;

before(async () => {
  tinyPng = await pixels(20, 25, () => 255);
  // La carpeta de datos se resuelve al importar: nunca la real.
  process.chdir(directory);
  pipeline = await import("../src/lib/flyers/pipeline");
  store = await import("../src/lib/flyers/store");
});
after(() => {
  process.chdir(previousDirectory);
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
  } catch {
    // Ignorar bloqueo transitorio de temp en Windows
  }
});

function engine(options: { scores?: number[]; assetFails?: boolean; canSee?: boolean } = {}): FlyerEngine & { assets: number; renders: string[] } {
  const scores = [...(options.scores || [9])];
  const state = {
    assets: 0,
    renders: [] as string[],
    canSee: options.canSee ?? true,
    ask: async (system: string) => {
      if (system.includes("director creativo")) return JSON.stringify({ concepts: FLYER_SAMPLES.filter((item) => ["red", "pasos", "afirmacion", "foto"].includes(item.template)) });
      const score = scores.length > 1 ? scores.shift()! : scores[0];
      return JSON.stringify({ score, problems: score < 8 ? ["titular débil"] : [], slots: {}, tone: score < 8 ? "claro" : undefined });
    },
    makeAsset: async () => {
      if (options.assetFails) throw new Error("ComfyUI está apagado.");
      state.assets += 1;
      return tinyPng;
    },
    render: async (page: string) => {
      state.renders.push(page);
      return tinyPng;
    },
  };
  return state;
}

test("un trabajo crea, revisa y guarda las cuatro propuestas", async () => {
  const fake = engine();
  const { job, done } = await pipeline.startFlyerJob({ brand: BRAND, brief: "pedido", format: "4:5", model: "x" }, fake);
  await done;
  const saved = store.readJobs().find((item) => item.id === job.id)!;
  assert.equal(saved.status, "done");
  assert.equal(saved.flyers.length, 4);
  assert.ok(saved.flyers.every((flyer) => flyer.revision === 1 && flyer.review?.approved && store.readFlyerFile(flyer.id, "imagen")));
  assert.equal(fake.assets, 1);
});

test("si falla un recurso, los demás flyers salen igual", async () => {
  const { job, done } = await pipeline.startFlyerJob({ brand: BRAND, brief: "pedido", format: "1:1", model: "x" }, engine({ assetFails: true }));
  await done;
  const saved = store.readJobs().find((item) => item.id === job.id)!;
  assert.equal(saved.status, "done");
  assert.equal(saved.flyers.filter((flyer) => flyer.revision === 1).length, 3);
  assert.match(saved.flyers.find((flyer) => flyer.error)?.error || "", /ComfyUI/);
});

test("se queda con la versión mejor puntuada, aunque la corrección empeore", async () => {
  const concept = FLYER_SAMPLES.find((item) => item.template === "afirmacion")!;
  const flyer = { id: "11111111-1111-4111-8111-111111111111", concept, format: "4:5" as const, hasAsset: false, revision: 0 };
  const result = await pipeline.produceFlyer(flyer, BRAND, "pedido", null, engine({ scores: [7, 4] }));
  assert.equal(result.review?.score, 7);
  assert.equal(result.concept.tone, "oscuro");
});

test("sin modelo con visión, entrega sin revisar", async () => {
  const concept = FLYER_SAMPLES.find((item) => item.template === "red")!;
  const flyer = { id: "22222222-2222-4222-8222-222222222222", concept, format: "4:5" as const, hasAsset: false, revision: 0 };
  const result = await pipeline.produceFlyer(flyer, BRAND, "pedido", null, engine({ canSee: false }));
  assert.equal(result.review, undefined);
});

test("no corren dos trabajos a la vez", async () => {
  const first = await pipeline.startFlyerJob({ brand: BRAND, brief: "uno", format: "4:5", model: "x" }, engine());
  await assert.rejects(pipeline.startFlyerJob({ brand: BRAND, brief: "dos", format: "4:5", model: "x" }, engine()), /Ya hay flyers/);
  await first.done;
});

test("un identificador no puede salir de la carpeta de flyers", () => {
  for (const id of ["../brands", "..\\..\\x", "", "a".repeat(36) + "/"]) assert.throws(() => store.readFlyerFile(id, "imagen"), /inválido/);
});

test("los datos de flyers no se suben al repositorio", () => {
  assert.match(readFileSync(path.join(previousDirectory, ".gitignore"), "utf8"), /^\/flyers-data\/$/m);
});
