import fs from "fs";
import path from "path";
import { prepareVram } from "./comfy-vram";

// Cliente reutilizable para generar imágenes y videos en ComfyUI
// Centraliza: salud, submit workflow, poll de historial y descarga de imagen/video

const COMFYUI_URL = process.env.COMFYUI_URL || "http://127.0.0.1:8188";
const REQUEST_TIMEOUT = 15000;
const MAX_WAIT = 600000; // 10 min: los modos de máxima calidad superan los 5
const MAX_VIDEO_WAIT = 600000; // 10 min

export interface ComfyGenerateOptions {
  timeout?: number;
}

export interface ComfyResult {
  image: string; // data:image/png;base64,...
  promptId: string;
  elapsed: string;
  filename: string;
}

export interface ComfyVideoResult {
  videoUrl: string; // e.g. "/generated-videos/video_xxx.mp4"
  videoPath: string; // local relative path
  promptId: string;
  elapsed: string;
  filename: string;
  sizeBytes: number;
}

// Nodos SaveImage conocidos por generador, más fallbacks comunes
const SAVE_NODES_BY_GENERATOR: Record<string, string[]> = {
  "flux-dev": ["9"],
  "flux-schnell": ["9"],
  "flux-2-klein": ["9"],
  "realvis-xl": ["9"],
  "z-image-turbo": ["10"],
  "ideogram-4": ["158"],
  "qwen-image-2.1": ["9"],
};

export async function comfyHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    const resp = await fetch(`${COMFYUI_URL}/system_stats`, { signal: controller.signal });
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}

// Limpia la cola y cancela ejecuciones activas
export async function comfyResetQueue(): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    await fetch(`${COMFYUI_URL}/interrupt`, { method: "POST", signal: controller.signal });
    clearTimeout(timer);
  } catch {
    // noop
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    await fetch(`${COMFYUI_URL}/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // noop
  }
}

/** Sube una imagen a ComfyUI y devuelve el nombre con el que la ve LoadImage. */
export async function comfyUpload(image: Buffer): Promise<string> {
  const form = new FormData();
  form.set("image", new Blob([new Uint8Array(image)], { type: "image/png" }), `saas_hub_${Date.now()}.png`);
  form.set("overwrite", "true");
  const response = await fetch(`${COMFYUI_URL}/upload/image`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) throw new Error(`ComfyUI no aceptó la imagen (HTTP ${response.status}).`);
  const data = (await response.json()) as { name?: string; subfolder?: string };
  if (!data.name) throw new Error("ComfyUI no confirmó la imagen.");
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

// Envía un workflow y espera el resultado, devolviendo la primera imagen encontrada
export async function comfyGenerate(
  workflow: Record<string, any>,
  generatorId: string,
  options: ComfyGenerateOptions = {}
): Promise<ComfyResult> {
  const maxWait = options.timeout || MAX_WAIT;

  if (!(await comfyHealth())) {
    throw new Error("ComfyUI no está corriendo. Verificá que el servidor esté encendido.");
  }

  // Cancelar lo que haya quedado activo para evitar mezclar trabajos
  await comfyResetQueue();
  await prepareVram(generatorId);

  const submitController = new AbortController();
  const submitTimer = setTimeout(() => submitController.abort(), REQUEST_TIMEOUT);
  let queueResp: Response;
  try {
    queueResp = await fetch(`${COMFYUI_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
      signal: submitController.signal,
    });
  } finally {
    clearTimeout(submitTimer);
  }

  if (!queueResp.ok) {
    const errText = await queueResp.text();
    throw new Error(`ComfyUI rechazó el workflow: ${errText}`);
  }

  const queueData = await queueResp.json();
  const promptId = queueData.prompt_id;
  if (!promptId) {
    throw new Error(`No se obtuvo prompt_id: ${JSON.stringify(queueData)}`);
  }

  const saveNodes = SAVE_NODES_BY_GENERATOR[generatorId] || ["9", "10", "158"];
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    let historyResp: Response;
    try {
      historyResp = await fetch(`${COMFYUI_URL}/history/${promptId}`, {
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      continue;
    }

    const historyData = await historyResp.json();
    const entry = historyData[promptId];
    if (!entry) {
      // Aún no terminó ni falló
      continue;
    }

    const outputs = entry.outputs || {};
    const nodesToCheck = Array.from(new Set([...saveNodes, "9", "10", "158"]));

    for (const nodeId of nodesToCheck) {
      const img = outputs[nodeId]?.images?.[0];
      if (!img) continue;

      const imageUrl = `${COMFYUI_URL}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${encodeURIComponent(img.type || "output")}`;

      const imgController = new AbortController();
      const imgTimer = setTimeout(() => imgController.abort(), REQUEST_TIMEOUT);
      let imgResp: Response;
      try {
        imgResp = await fetch(imageUrl, { signal: imgController.signal });
      } catch {
        continue;
      } finally {
        clearTimeout(imgTimer);
      }

      if (!imgResp.ok) continue;

      const arrayBuffer = await imgResp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      return {
        image: `data:image/png;base64,${buffer.toString("base64")}`,
        promptId,
        elapsed,
        filename: img.filename,
      };
    }

    if (entry.status?.status_str === "error") {
      const messages = entry.status?.messages || [];
      const err = messages.find((m: any[]) => m[0] === "execution_error")?.[1];
      throw new Error(`ComfyUI falló: ${err?.exception_message || JSON.stringify(messages)}`);
    }
  }

  throw new Error(`Timeout (${Math.round(maxWait / 1000)}s) esperando la generación`);
}

// Envía un workflow de video (Wan 2.2), espera la renderización y guarda el archivo en public/generated-videos/
export async function comfyGenerateVideo(
  workflow: Record<string, any>,
  options: ComfyGenerateOptions = {}
): Promise<ComfyVideoResult> {
  const maxWait = options.timeout || MAX_VIDEO_WAIT;

  if (!(await comfyHealth())) {
    throw new Error("ComfyUI no está corriendo. Verificá que el servidor esté encendido.");
  }

  await comfyResetQueue();
  await prepareVram("video");

  const submitController = new AbortController();
  const submitTimer = setTimeout(() => submitController.abort(), REQUEST_TIMEOUT);
  let queueResp: Response;
  try {
    queueResp = await fetch(`${COMFYUI_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
      signal: submitController.signal,
    });
  } finally {
    clearTimeout(submitTimer);
  }

  if (!queueResp.ok) {
    const errText = await queueResp.text();
    throw new Error(`ComfyUI rechazó el workflow de video: ${errText}`);
  }

  const queueData = await queueResp.json();
  const promptId = queueData.prompt_id;
  if (!promptId) {
    throw new Error(`No se obtuvo prompt_id: ${JSON.stringify(queueData)}`);
  }

  const startTime = Date.now();
  const videosDir = path.join(process.cwd(), "public", "generated-videos");
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  while (Date.now() - startTime < maxWait) {
    await new Promise((resolve) => setTimeout(resolve, 4000));

    let historyResp: Response;
    try {
      historyResp = await fetch(`${COMFYUI_URL}/history/${promptId}`, {
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      continue;
    }

    const historyData = await historyResp.json();
    const entry = historyData[promptId];
    if (!entry) {
      continue;
    }

    const outputs = entry.outputs || {};

    // Buscar archivo en nodo 80 (SaveVideo) o en cualquier otro nodo de salida
    let videoMeta: { filename: string; subfolder?: string; type?: string } | null = null;

    // 1. Revisar nodo 80 primero
    const node80 = outputs["80"];
    if (node80) {
      const candidate = node80.videos?.[0] || node80.images?.[0] || node80.gifs?.[0];
      if (candidate?.filename) {
        videoMeta = candidate;
      }
    }

    // 2. Si no, recorrer todos los nodos de outputs
    if (!videoMeta) {
      for (const [_, nodeOut] of Object.entries<any>(outputs)) {
        const candidate = nodeOut?.videos?.[0] || nodeOut?.images?.[0] || nodeOut?.gifs?.[0];
        if (candidate?.filename && (candidate.filename.endsWith(".mp4") || candidate.filename.endsWith(".webm") || candidate.filename.endsWith(".gif"))) {
          videoMeta = candidate;
          break;
        }
      }
    }

    if (videoMeta) {
      const videoFetchUrl = `${COMFYUI_URL}/view?filename=${encodeURIComponent(videoMeta.filename)}&subfolder=${encodeURIComponent(videoMeta.subfolder || "")}&type=${encodeURIComponent(videoMeta.type || "output")}`;

      const dlController = new AbortController();
      const dlTimer = setTimeout(() => dlController.abort(), 60000);
      let vidResp: Response;
      try {
        vidResp = await fetch(videoFetchUrl, { signal: dlController.signal });
      } catch (err: any) {
        console.warn(`[ComfyUI Video] Error descargando archivo de video: ${err.message}`);
        continue;
      } finally {
        clearTimeout(dlTimer);
      }

      if (!vidResp.ok) {
        console.warn(`[ComfyUI Video] HTTP ${vidResp.status} descargando video`);
        continue;
      }

      const arrayBuffer = await vidResp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const ext = path.extname(videoMeta.filename) || ".mp4";
      const cleanPromptId = promptId.replace(/[^a-zA-Z0-9_-]/g, "");
      const savedFilename = `wan_${cleanPromptId}_${Date.now()}${ext}`;
      const targetAbsPath = path.join(videosDir, savedFilename);

      fs.writeFileSync(targetAbsPath, buffer);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const videoUrl = `/generated-videos/${savedFilename}`;

      return {
        videoUrl,
        videoPath: videoUrl,
        promptId,
        elapsed: `${elapsed}s`,
        filename: videoMeta.filename,
        sizeBytes: buffer.length,
      };
    }

    if (entry.status?.status_str === "error") {
      const messages = entry.status?.messages || [];
      const err = messages.find((m: any[]) => m[0] === "execution_error")?.[1];
      throw new Error(`ComfyUI falló al procesar video: ${err?.exception_message || JSON.stringify(messages)}`);
    }
  }

  throw new Error(`Timeout (${Math.round(maxWait / 1000)}s) esperando la generación de video`);
}
