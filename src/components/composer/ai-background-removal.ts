import { preloadImage, removeSolidBackground } from "./canvas-renderer";

export interface BackgroundRemoval {
  image: string;
  /** "ia": recorte real con Qwen. "color": método simple, si ComfyUI no está disponible. */
  method: "ia" | "color";
}

/** Por debajo es halo del modelo; por encima, opaco. */
const ALPHA_FLOOR = 16;
const ALPHA_CEIL = 240;
/** Fuera de este rango el modelo no recortó nada o borró todo. */
const MIN_OPAQUE = 0.01;
const MAX_OPAQUE = 0.99;
/** A veces devuelve la imagen vacía según la semilla: se vuelve a intentar. */
const MAX_ATTEMPTS = 3;

function createContext(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("El navegador no pudo preparar el recorte.");
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

/** Elimina el halo casi transparente y cierra las zonas casi opacas. */
export function cleanAlpha(value: number): number {
  if (value <= ALPHA_FLOOR) return 0;
  if (value >= ALPHA_CEIL) return 255;
  return Math.round(((value - ALPHA_FLOOR) / (ALPHA_CEIL - ALPHA_FLOOR)) * 255);
}

/** Proporción de píxeles opacos (datos RGBA). */
export function opaqueRatio(data: ArrayLike<number>): number {
  let opaque = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] > 128) opaque += 1;
  return data.length ? opaque / (data.length / 4) : 0;
}

export function isUsableCut(ratio: number): boolean {
  return ratio >= MIN_OPAQUE && ratio <= MAX_OPAQUE;
}

/** Limpia el alfa y devuelve cuánto quedó opaco. */
function cleanAlphaOf(ctx: CanvasRenderingContext2D): number {
  const { width, height } = ctx.canvas;
  const pixels = ctx.getImageData(0, 0, width, height);
  for (let index = 3; index < pixels.data.length; index += 4)
    pixels.data[index] = cleanAlpha(pixels.data[index]);
  ctx.putImageData(pixels, 0, 0);
  return opaqueRatio(pixels.data);
}

/** Limpia el canal alfa de un PNG generado con transparencia. */
export async function cleanTransparentImage(src: string): Promise<string> {
  const image = await preloadImage(src);
  const ctx = createContext(image.naturalWidth, image.naturalHeight);
  ctx.drawImage(image, 0, 0);
  if (cleanAlphaOf(ctx) < MIN_OPAQUE)
    throw new Error("La imagen salió vacía. Volvé a generarla.");
  return ctx.canvas.toDataURL("image/png");
}

/**
 * Quita el fondo. Del modelo solo se usa la silueta: los píxeles son los de la
 * imagen original, para no alterar caras, productos ni logos.
 */
export async function removeBackground(src: string, tolerance = 45): Promise<BackgroundRemoval> {
  const original = await preloadImage(src);
  const { naturalWidth: width, naturalHeight: height } = original;
  const source = createContext(width, height);
  source.drawImage(original, 0, 0);

  const body = JSON.stringify({ image: source.canvas.toDataURL("image/png"), width, height });
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch("/api/remove-background", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (response.status === 503)
      return { image: await removeSolidBackground(src, tolerance), method: "color" };
    const data = await response.json();
    if (!response.ok || !data.image) throw new Error(data.error || "No se pudo quitar el fondo.");

    const cut = await preloadImage(data.image);
    const mask = createContext(width, height);
    mask.drawImage(cut, 0, 0, width, height);
    if (!isUsableCut(cleanAlphaOf(mask))) continue;
    source.globalCompositeOperation = "destination-in";
    source.drawImage(mask.canvas, 0, 0);
    return { image: source.canvas.toDataURL("image/png"), method: "ia" };
  }
  throw new Error("El modelo no pudo separar el fondo de esta imagen.");
}
