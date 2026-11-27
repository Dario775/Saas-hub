import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildMotionHtml, motionTiming, type MotionTiming } from "../motion/motion-html";
import { finishVideo, prepareWorkspace, renderVideo } from "../motion/render-video";
import { buildSoundtrack } from "../motion/sound";
import { CUSTOM_STYLE, MOTION_STYLES, resolveStyle, type MotionStyle, type MotionStyleChoice } from "../motion/styles";
import { designFlyerVideo } from "./motion-custom";
import { flyerContext } from "./context";
import { prepareLogo } from "./images";
import { assertSafeId, readFlyerFile, readJobs, updateJob } from "./store";
import { findTemplate } from "./templates";
import { displayFont } from "./theme";
import type { Flyer, FlyerBrand, FlyerJob, FlyerVideo } from "./types";

/** Duraciones ofrecidas: con menos, los diseños con más contenido no llegan a leerse. */
export const VIDEO_SECONDS = [10, 12, 15] as const;
export const DEFAULT_VIDEO_SECONDS = 12;
const MUSIC_EXTENSIONS = new Set([".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac"]);
const CTA = "Escribinos";
const ASSET_NAME = "recurso.png";

/** Dependencias externas, reemplazables en tests. */
export interface MotionEngine {
  prepare: typeof prepareWorkspace;
  render: (directory: string, output: string) => Promise<string>;
  finish: typeof finishVideo;
  /** Diseño "a medida" con Claude. */
  custom: typeof designFlyerVideo;
}

const defaultEngine: MotionEngine = {
  prepare: prepareWorkspace,
  render: (directory, output) => renderVideo(directory, output),
  finish: finishVideo,
  custom: designFlyerVideo,
};

const worker = globalThis as typeof globalThis & { saasMotionBusy?: boolean };

export function readVideoSeconds(value: unknown): number {
  const seconds = Number(value);
  return (VIDEO_SECONDS as readonly number[]).includes(seconds) ? seconds : DEFAULT_VIDEO_SECONDS;
}

/** Carpeta con música libre de derechos que el usuario elige tener. */
export function musicDir(): string {
  return process.env.MOTION_MUSIC_DIR || path.join(process.cwd(), "motion-music");
}

/** Elige una pista de la carpeta. La misma semilla da siempre la misma pista. */
export function pickTrack(directory: string, seed: string): string | null {
  let files: string[];
  try {
    files = fs
      .readdirSync(directory)
      .filter((file) => MUSIC_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort();
  } catch {
    return null;
  }
  if (!files.length) return null;
  const index = createHash("sha256").update(seed).digest().readUInt32BE(0) % files.length;
  return path.join(directory, files[index]);
}

function workspaceDir(flyerId: string): string {
  return path.join(process.cwd(), "flyers-data", "motion", assertSafeId(flyerId));
}

/** El video se publica desde la biblioteca de medios, como los demás videos del panel. */
function publicVideo(flyerId: string): { file: string; url: string } {
  const name = `flyer-${assertSafeId(flyerId)}-${Date.now()}.mp4`;
  return { file: path.join(process.cwd(), "public", "generated-videos", name), url: `/generated-videos/${name}` };
}

export function removePublicVideo(url: string | undefined): void {
  const match = /^\/generated-videos\/(flyer-[0-9a-f-]{36}-\d+\.mp4)$/.exec(url || "");
  if (!match) return;
  try {
    fs.rmSync(path.join(process.cwd(), "public", "generated-videos", match[1]), { force: true });
  } catch {
    // Si Windows lo tiene abierto, queda como archivo huérfano.
  }
}

function cleanUp(directory: string): void {
  try {
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
  } catch {
    // Windows puede demorar en soltar los archivos.
  }
}

function setVideo(jobId: string, flyerId: string, video: FlyerVideo): Promise<void> {
  return updateJob(jobId, (job) => ({
    ...job,
    flyers: job.flyers.map((flyer) => (flyer.id === flyerId ? { ...flyer, video } : flyer)),
  }));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo crear el video.";
}

/** Música y efectos sobre la grilla de la animación. Con música propia, solo efectos. */
function writeSoundtrack(directory: string, seed: string, timing: MotionTiming, style: MotionStyle, hasTrack: boolean): string {
  const file = path.join(directory, "sonido.wav");
  const { duration, bpm, outroStart, hook } = timing;
  fs.writeFileSync(file, buildSoundtrack({ duration, bpm, outroStart, bed: !hasTrack, seed, style, accents: [hook.land] }));
  return file;
}

interface AnimateRequest {
  jobId: string;
  flyerId: string;
  brand: FlyerBrand;
  seconds: number;
  music: boolean;
  /** Estilo pedido; "auto" elige uno distinto en cada armado. */
  style?: MotionStyleChoice;
}

async function produceVideo(flyer: Flyer, request: AnimateRequest, engine: MotionEngine): Promise<FlyerVideo> {
  const template = findTemplate(flyer.concept.template);
  if (!template) throw new Error("El diseño ya no está disponible.");
  const directory = workspaceDir(flyer.id);
  const composition = path.join(directory, "composicion");
  cleanUp(directory);
  fs.mkdirSync(directory, { recursive: true });
  try {
    // Cada armado tiene su semilla: rehacer un video da otra música (y otro estilo si es automático).
    const seed = `${flyer.id}:${Date.now()}`;
    const style = resolveStyle(request.style ?? "auto", seed);
    const timing = motionTiming(request.seconds, MOTION_STYLES[style].bpm);
    const track = request.music ? pickTrack(musicDir(), seed) : null;
    const asset = flyer.hasAsset ? readFlyerFile(flyer.id, "recurso") : null;
    const logo = await prepareLogo(request.brand.logoDataUrl);
    const context = flyerContext(flyer.concept, flyer.format, request.brand, logo, asset ? ASSET_NAME : null);
    const font = displayFont(request.brand.headingFont);
    const assetFile = asset ? { name: ASSET_NAME, data: asset } : null;
    let concept: string | undefined;
    if (request.style === CUSTOM_STYLE) {
      const step = (text: string) => setVideo(request.jobId, flyer.id, { status: "running", seconds: request.seconds, music: request.music, custom: true, step: text });
      ({ concept } = await engine.custom({ concept: flyer.concept, context, font, cta: CTA, timing, asset: assetFile, directory: composition, prepare: engine.prepare, step }));
      await step("Grabando el video");
    } else {
      const html = buildMotionHtml(template, context, font, { duration: request.seconds, cta: CTA, bpm: timing.bpm });
      engine.prepare(composition, { html, asset: assetFile ?? undefined });
    }
    const silent = path.join(directory, "mudo.mp4");
    await engine.render(composition, silent);
    const soundtrack = request.music ? writeSoundtrack(directory, seed, timing, style, Boolean(track)) : null;
    const output = publicVideo(flyer.id);
    fs.mkdirSync(path.dirname(output.file), { recursive: true });
    await engine.finish({ silent, soundtrack, music: track, duration: request.seconds, output: output.file });
    const custom = request.style === CUSTOM_STYLE;
    return { status: "done", seconds: request.seconds, music: request.music, track: Boolean(track), style, url: output.url, ...(custom ? { custom, concept } : {}) };
  } finally {
    cleanUp(directory);
  }
}

/** Anima un flyer terminado. Responde enseguida; el video se arma en segundo plano. */
export async function animateFlyer(request: AnimateRequest, engine: MotionEngine = defaultEngine): Promise<{ job: FlyerJob; done: Promise<void> }> {
  const job = readJobs().find((item) => item.id === request.jobId);
  const flyer = job?.flyers.find((item) => item.id === request.flyerId);
  if (!job || !flyer) throw new Error("No encontramos ese flyer.");
  if (!flyer.revision) throw new Error("Ese flyer todavía no está listo.");
  if (worker.saasMotionBusy) throw new Error("Ya hay un video en preparación. Esperá a que termine.");
  worker.saasMotionBusy = true;
  const previous = flyer.video?.url;
  try {
    await setVideo(job.id, flyer.id, { status: "running", seconds: request.seconds, music: request.music, custom: request.style === CUSTOM_STYLE });
  } catch (error) {
    worker.saasMotionBusy = false;
    throw error;
  }
  const done = produceVideo(flyer, request, engine)
    .then(async (video) => {
      await setVideo(job.id, flyer.id, video);
      if (previous && previous !== video.url) removePublicVideo(previous);
    })
    .catch(async (error) => {
      console.error("[Motion]", message(error));
      await setVideo(job.id, flyer.id, { status: "failed", seconds: request.seconds, music: request.music, error: message(error) });
    })
    .finally(() => {
      worker.saasMotionBusy = false;
    });
  return { job: readJobs().find((item) => item.id === job.id)!, done };
}

/** Un video que quedó "en curso" tras reiniciar el panel ya no se está armando. */
export function settleVideos(job: FlyerJob): FlyerJob {
  if (worker.saasMotionBusy || !job.flyers.some((flyer) => flyer.video?.status === "running")) return job;
  return {
    ...job,
    flyers: job.flyers.map((flyer) =>
      flyer.video?.status === "running"
        ? { ...flyer, video: { ...flyer.video, status: "failed", error: "Se interrumpió la preparación del video." } }
        : flyer,
    ),
  };
}

export function isMotionBusy(): boolean {
  return Boolean(worker.saasMotionBusy);
}
