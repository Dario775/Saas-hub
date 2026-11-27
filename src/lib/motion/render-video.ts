import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { MOTION_FILES } from "./motion-html";

const run = promisify(execFile);
const RENDER_TIMEOUT_MS = 10 * 60_000;
const FINISH_TIMEOUT_MS = 5 * 60_000;
const CHECK_TIMEOUT_MS = 2 * 60_000;
export const MOTION_FPS = 30;
/** Cuadros intermedios por cuadro final: se mezclan en desenfoque de movimiento. */
export const MOTION_SUBFRAMES = 5;

/** El renderizador vive aislado, con sus propias dependencias. */
export function motionToolDir(): string {
  return path.join(process.cwd(), "tools", "motion");
}

function hyperframesBin(): string {
  const bin = path.join(motionToolDir(), "node_modules", "hyperframes", "bin", "hyperframes.mjs");
  if (!fs.existsSync(bin))
    throw new Error("Falta instalar el renderizador de video. Ejecutá: npm ci --prefix tools/motion --ignore-scripts");
  return bin;
}

function gsapFile(): string {
  return path.join(process.cwd(), "node_modules", "gsap", "dist", "gsap.min.js");
}

function choreographyFile(): string {
  return path.join(motionToolDir(), "runtime", "choreography.js");
}

export function ffmpegPath(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

export interface Workspace {
  html: string;
  /** Imagen del diseño (foto u objeto), si la tiene. */
  asset?: { name: string; data: Buffer };
  /** Otros archivos que usa la composición (por ejemplo, los logos). */
  files?: Array<{ name: string; data: Buffer }>;
}

/** Arma la carpeta que HyperFrames convierte en video. */
export function prepareWorkspace(directory: string, workspace: Workspace): void {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.html"), workspace.html, "utf8");
  fs.copyFileSync(gsapFile(), path.join(directory, MOTION_FILES.gsap));
  fs.copyFileSync(choreographyFile(), path.join(directory, MOTION_FILES.choreography));
  if (workspace.asset) fs.writeFileSync(path.join(directory, workspace.asset.name), workspace.asset.data);
  for (const file of workspace.files ?? []) fs.writeFileSync(path.join(directory, path.basename(file.name)), file.data);
}

function hyperframesEnv(): NodeJS.ProcessEnv {
  return { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1" };
}

function lastLines(text: string, count = 2): string {
  return text.split(/\r?\n/).slice(-count).join(" ");
}

function stderrOf(error: unknown): string {
  return error instanceof Error && "stderr" in error ? String((error as { stderr?: string }).stderr || "").trim() : "";
}

/**
 * Abre la composición en Chrome y devuelve los errores de JavaScript o de
 * archivos faltantes. Vacío: está sana.
 */
export async function validateComposition(directory: string): Promise<string[]> {
  let stdout = "";
  try {
    ({ stdout } = await run(process.execPath, [hyperframesBin(), "validate", directory, "--json", "--no-contrast", "--timeout", "15000"], {
      cwd: motionToolDir(),
      timeout: CHECK_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      env: hyperframesEnv(),
    }));
  } catch (error) {
    // validate sale con error cuando encuentra problemas: el JSON viene igual.
    stdout = error instanceof Error && "stdout" in error ? String((error as { stdout?: string }).stdout || "") : "";
    if (!stdout.trim()) return [`La composición no se pudo abrir. ${lastLines(stderrOf(error))}`.trim()];
  }
  const start = stdout.indexOf("{");
  try {
    const report = JSON.parse(stdout.slice(start)) as { ok?: boolean; errors?: unknown[] };
    const errors = (report.errors ?? []).map((item) => (typeof item === "string" ? item : JSON.stringify(item)).slice(0, 400));
    return report.ok === false && !errors.length ? ["La composición tiene errores que no se pudieron leer."] : errors;
  } catch {
    return ["No se pudo leer el resultado del control de la composición."];
  }
}

/** Saca cuadros parejos del video y devuelve la hoja (JPEG) con el segundo de cada uno. */
export async function snapshotSheet(directory: string, output: string, frames = 8): Promise<Buffer> {
  fs.rmSync(output, { recursive: true, force: true });
  try {
    await run(process.execPath, [hyperframesBin(), "snapshot", directory, "--frames", String(frames), "-o", output], {
      cwd: motionToolDir(),
      timeout: CHECK_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      env: hyperframesEnv(),
    });
  } catch (error) {
    throw new Error(`No se pudieron sacar cuadros del borrador. ${lastLines(stderrOf(error))}`.trim());
  }
  const sheet = path.join(output, "contact-sheet.jpg");
  if (!fs.existsSync(sheet)) throw new Error("No se generó la hoja de cuadros del borrador.");
  return fs.readFileSync(sheet);
}

export interface FinishOptions {
  /** Video mudo que salió de HyperFrames, grabado a MOTION_FPS × MOTION_SUBFRAMES. */
  silent: string;
  /** WAV con el sonido generado (ritmo y efectos). Sin él, el video sale mudo. */
  soundtrack: string | null;
  /** Pista de música propia, si la hay. Va debajo de los efectos. */
  music: string | null;
  duration: number;
  output: string;
}

/**
 * Mezcla los subcuadros en desenfoque de movimiento, baja a MOTION_FPS y suma
 * el sonido. Es el último paso: deja el MP4 listo para redes.
 */
export async function finishVideo(options: FinishOptions): Promise<void> {
  const { duration } = options;
  const blur = `[0:v]tmix=frames=${MOTION_SUBFRAMES},select='eq(mod(n,${MOTION_SUBFRAMES}),${MOTION_SUBFRAMES - 1})',setpts=N/(${MOTION_FPS}*TB),format=yuv420p[v]`;
  const loudness = "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]";
  const audio = !options.soundtrack
    ? ""
    : options.music
    ? `[2:a]atrim=0:${duration},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, duration - 1.6).toFixed(2)}:d=1.6,volume=0.7[m];[1:a][m]amix=inputs=2:normalize=0,${loudness}`
    : `[1:a]${loudness}`;
  await run(
    ffmpegPath(),
    [
      "-v", "error", "-y",
      "-i", options.silent,
      ...(options.soundtrack ? ["-i", options.soundtrack] : []),
      ...(options.soundtrack && options.music ? ["-i", options.music] : []),
      "-filter_complex", audio ? `${blur};${audio}` : blur,
      "-map", "[v]",
      ...(audio ? ["-map", "[a]"] : ["-an"]),
      "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-r", String(MOTION_FPS),
      "-c:a", "aac", "-b:a", "192k",
      "-t", String(duration), "-movflags", "+faststart",
      options.output,
    ],
    { timeout: FINISH_TIMEOUT_MS, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
  );
  if (!fs.existsSync(options.output) || fs.statSync(options.output).size < 10_000) throw new Error("No se pudo terminar el video.");
}

/** Renderiza la carpeta a MP4. Devuelve la ruta del video. */
export async function renderVideo(directory: string, output: string, fps = MOTION_FPS * MOTION_SUBFRAMES): Promise<string> {
  const args = [hyperframesBin(), "render", directory, "--output", output, "--fps", String(fps), "--quality", "high"];
  try {
    await run(process.execPath, args, {
      cwd: motionToolDir(),
      timeout: RENDER_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1" },
    });
  } catch (error) {
    const detail = error instanceof Error && "stderr" in error ? String((error as { stderr?: string }).stderr || "").trim() : "";
    throw new Error(`No se pudo renderizar el video.${detail ? ` ${detail.split("\n").slice(-3).join(" ")}` : ""}`);
  }
  if (!fs.existsSync(output) || fs.statSync(output).size < 10_000) throw new Error("El renderizador no generó el video.");
  return output;
}
