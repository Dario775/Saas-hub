import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { ffmpegPath } from "../motion/render-video";
import { agentDir } from "./store";

const run = promisify(execFile);
const TIMEOUT_MS = 3 * 60_000;
/** Un audio de pedido dura segundos; más de 5 minutos es un error o un abuso. */
export const MAX_AUDIO_SECONDS = 300;

/** Modelo ggml de whisper.cpp (por ejemplo ggml-large-v3-turbo.bin). */
export function whisperModel(env: NodeJS.ProcessEnv = process.env): string | null {
  const file = env.WHISPER_MODEL_PATH;
  return file && fs.existsSync(file) ? file : null;
}

/**
 * Valor para una opción de filtro de ffmpeg. Se interpreta dos veces (el grafo
 * y la opción), así que cada carácter especial lleva doble escape.
 */
export function filterValue(file: string): string {
  return file.replace(/\\/g, "/").replace(/([:',;[\]])/g, "\\\\$1");
}

/**
 * Pasa a texto un audio de Telegram (OGG/Opus) con whisper.cpp dentro de
 * ffmpeg, en la placa de video. Nada sale de la PC.
 */
export async function transcribe(audio: Buffer, model = whisperModel()): Promise<string> {
  if (!model) throw new Error("Los audios todavía no están activados: falta el modelo de Whisper (WHISPER_MODEL_PATH).");
  const folder = path.join(agentDir(), "audio");
  fs.mkdirSync(folder, { recursive: true });
  const id = randomUUID();
  const input = path.join(folder, `${id}.ogg`);
  const output = path.join(folder, `${id}.txt`);
  fs.writeFileSync(input, audio);
  try {
    // La salida va relativa a la carpeta de trabajo: sin espacios ni unidades que escapar.
    const filter = `whisper=model=${filterValue(model)}:language=es:queue=30:format=text:destination=${filterValue(path.basename(output))}`;
    await run(ffmpegPath(), ["-v", "error", "-y", "-t", String(MAX_AUDIO_SECONDS), "-i", input, "-af", filter, "-f", "null", "-"], {
      cwd: folder,
      timeout: TIMEOUT_MS,
      windowsHide: true,
    });
    const text = fs.existsSync(output) ? fs.readFileSync(output, "utf8") : "";
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) throw new Error("No se entendió el audio. Probá de nuevo o escribilo.");
    return clean;
  } finally {
    fs.rmSync(input, { force: true });
    fs.rmSync(output, { force: true });
  }
}
