/**
 * Reserva la VRAM para la generación del panel.
 *
 * Antes de generar descarga los modelos que ComfyUI tenga en memoria de otro
 * flujo y los que Ollama haya dejado cargados. No cierra programas ni procesos.
 * Nunca bloquea una generación: si algo falla, se sigue con la memoria que haya.
 */

const COMFY_TIMEOUT_MS = 5_000;
const OLLAMA_TIMEOUT_MS = 1_500;
const POLL_INTERVAL_MS = 400;
const MAX_POLLS = 12;
/** Proporción de VRAM libre que se considera suficiente para empezar. */
const ENOUGH_FREE_RATIO = 0.85;

interface VramState {
  saasComfyWorkload?: string;
}

const state = globalThis as typeof globalThis & VramState;

export interface PrepareVramOptions {
  comfyUrl?: string;
  ollamaUrl?: string;
  /** Inyectables para tests. */
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
}

export interface VramReport {
  /** Se pidió a ComfyUI descargar modelos de otro flujo. */
  freed: boolean;
  unloadedLlms: string[];
  freeRatio?: number;
}

function isLocal(url: string): boolean {
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function unloadOllama(url: string, request: typeof fetch): Promise<string[]> {
  // Solo el de este equipo: descargar modelos de otro servidor no libera esta GPU.
  if (!isLocal(url)) return [];
  const base = url.replace(/\/+$/, "");
  try {
    const response = await request(`${base}/api/ps`, { signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS) });
    if (!response.ok) return [];
    const data = (await response.json()) as { models?: { name?: string }[] };
    const names = (data.models || []).map((model) => model.name || "").filter(Boolean);
    for (const name of names) {
      await request(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: name, keep_alive: 0 }),
        signal: AbortSignal.timeout(COMFY_TIMEOUT_MS),
      });
    }
    return names;
  } catch {
    return []; // Ollama apagado: no hay nada que liberar.
  }
}

async function freeRatio(comfyUrl: string, request: typeof fetch): Promise<number | undefined> {
  const response = await request(`${comfyUrl}/system_stats`, { signal: AbortSignal.timeout(COMFY_TIMEOUT_MS) });
  if (!response.ok) return undefined;
  const data = (await response.json()) as { devices?: { vram_total?: number; vram_free?: number }[] };
  const device = data.devices?.[0];
  return device?.vram_total ? (device.vram_free || 0) / device.vram_total : undefined;
}

/** ComfyUI libera en segundo plano: espera a que termine antes de encolar. */
async function waitUntilFree(
  comfyUrl: string,
  request: typeof fetch,
  intervalMs: number,
): Promise<number | undefined> {
  let last: number | undefined;
  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await freeRatio(comfyUrl, request);
    if (last === undefined || last >= ENOUGH_FREE_RATIO) return last;
  }
  return last;
}

/**
 * Deja la VRAM disponible para `workload` (el id del generador).
 * Si es el mismo flujo que la vez anterior no descarga nada: los modelos ya
 * cargados son los que hacen falta y recargarlos solo demoraría.
 */
export async function prepareVram(
  workload: string,
  options: PrepareVramOptions = {},
): Promise<VramReport> {
  const request = options.fetchImpl || fetch;
  const comfyUrl = options.comfyUrl || process.env.COMFYUI_URL || "http://127.0.0.1:8188";
  const ollamaUrl = options.ollamaUrl || process.env.LOCAL_LLM_URL || "http://127.0.0.1:11434";

  const unloadedLlms = await unloadOllama(ollamaUrl, request);
  if (state.saasComfyWorkload === workload) return { freed: false, unloadedLlms };

  try {
    const response = await request(`${comfyUrl}/free`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(COMFY_TIMEOUT_MS),
    });
    if (!response.ok) return { freed: false, unloadedLlms };
    const ratio = await waitUntilFree(comfyUrl, request, options.pollIntervalMs ?? POLL_INTERVAL_MS);
    state.saasComfyWorkload = workload;
    return { freed: true, unloadedLlms, freeRatio: ratio };
  } catch (error) {
    console.warn("[VRAM] No se pudo liberar memoria:", error instanceof Error ? error.message : String(error));
    return { freed: false, unloadedLlms };
  }
}
