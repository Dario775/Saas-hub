// Motor de generación de video con Wan 2.2 14B T2V (ComfyUI)
// Carga y parametrización dinámica del workflow de video

import fs from "fs";
import path from "path";

export interface WanVideoOptions {
  aspectRatio?: "9:16" | "1:1" | "16:9";
  width?: number;
  height?: number;
  duration?: number; // Segundos (ej: 3, 5)
  fps?: number; // Default 16
  lightning?: boolean; // True: 4 steps LoRA, False: 20 steps
  seed?: number;
  negativePrompt?: string;
}

export const WAN_ASPECT_RATIOS: Record<string, { width: number; height: number; label: string; desc: string }> = {
  "9:16": {
    width: 480,
    height: 832,
    label: "9:16 Vertical",
    desc: "Reels, TikTok, Stories (Recomendado)",
  },
  "1:1": {
    width: 640,
    height: 640,
    label: "1:1 Cuadrado",
    desc: "Feed de Facebook e Instagram",
  },
  "16:9": {
    width: 832,
    height: 480,
    label: "16:9 Horizontal",
    desc: "Video panorámico / YouTube",
  },
};

export const DEFAULT_WAN_NEGATIVE_PROMPT =
  "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走，裸露，NSFW, distorted text, ugly, blurry, deformed limbs, watermark, bad anatomy, bad hands, low resolution";

// Cargar plantilla base de video_wan2_2_14B_t2v.json
let cachedBaseWorkflow: Record<string, any> | null = null;

export function getBaseWanWorkflow(): Record<string, any> {
  if (cachedBaseWorkflow) {
    return JSON.parse(JSON.stringify(cachedBaseWorkflow));
  }

  const filePath = path.join(process.cwd(), "video_wan2_2_14B_t2v.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo de workflow base en: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  cachedBaseWorkflow = JSON.parse(content);
  return JSON.parse(JSON.stringify(cachedBaseWorkflow));
}

// Generador de semillas aleatorias de 32-bit enteros positivos
function generateSeed(): number {
  return Math.floor(Math.random() * 1000000000000000);
}

// Alinear resoluciones a múltiplos de 16
function align16(n: number): number {
  return Math.max(Math.round(n / 16) * 16, 256);
}

/**
 * Construye el workflow JSON listo para ComfyUI con los parámetros especificados
 */
export function buildWanVideoWorkflow(
  prompt: string,
  options: WanVideoOptions = {}
): Record<string, any> {
  const workflow = getBaseWanWorkflow();

  const aspect = options.aspectRatio || "9:16";
  const preset = WAN_ASPECT_RATIOS[aspect] || WAN_ASPECT_RATIOS["9:16"];

  const width = align16(options.width || preset.width);
  const height = align16(options.height || preset.height);
  const duration = options.duration || 5;
  const fps = options.fps || 16;
  const lightning = options.lightning !== undefined ? options.lightning : false;
  const seed = options.seed || generateSeed();

  const userNegative = options.negativePrompt?.trim();
  const finalNegative = userNegative
    ? `${userNegative}, ${DEFAULT_WAN_NEGATIVE_PROMPT}`
    : DEFAULT_WAN_NEGATIVE_PROMPT;

  // 1. Inyectar Prompt Positivo (Nodo 128:89)
  if (workflow["128:89"]?.inputs) {
    workflow["128:89"].inputs.text = prompt;
  }

  // 2. Inyectar Prompt Negativo (Nodo 128:72)
  if (workflow["128:72"]?.inputs) {
    workflow["128:72"].inputs.text = finalNegative;
  }

  // 3. Inyectar Dimensiones de Latent (Nodo 128:74)
  if (workflow["128:74"]?.inputs) {
    workflow["128:74"].inputs.width = width;
    workflow["128:74"].inputs.height = height;
  }

  // 4. Inyectar FPS (Nodo 128:125)
  if (workflow["128:125"]?.inputs) {
    workflow["128:125"].inputs.value = fps;
  }

  // 5. Inyectar Duración en segundos (Nodo 128:126)
  if (workflow["128:126"]?.inputs) {
    workflow["128:126"].inputs.value = duration;
  }

  // 6. Inyectar Switch Lightning (Nodo 128:129)
  // true = 4 pasos rápidos con LoRA, false = 20 pasos calidad completa
  if (workflow["128:129"]?.inputs) {
    workflow["128:129"].inputs.value = lightning;
  }

  // 7. Inyectar Semilla en KSampler (Nodo 128:81)
  if (workflow["128:81"]?.inputs) {
    workflow["128:81"].inputs.noise_seed = seed;
  }

  // 8. Asegurar prefijo de guardado en SaveVideo (Nodo 80)
  if (workflow["80"]?.inputs) {
    workflow["80"].inputs.filename_prefix = "video/Wan2_2_SaaS";
    workflow["80"].inputs.format = "auto";
    workflow["80"].inputs.codec = "auto";
  }

  return workflow;
}
