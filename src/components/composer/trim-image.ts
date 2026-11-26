import { preloadImage } from "./canvas-renderer";

/** Lado con el que se dibuja el logo para buscar sus bordes. */
const RASTER_SIZE = 1024;
const ALPHA_VISIBLE = 12;

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Rectángulo con contenido visible (datos RGBA). Nulo si está vacío. */
export function contentBounds(data: ArrayLike<number>, width: number, height: number): ContentBounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= ALPHA_VISIBLE) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Quita el margen transparente de un logo. Si no se puede, devuelve el original. */
export async function trimTransparentMargin(src: string): Promise<string> {
  try {
    const image = await preloadImage(src);
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    if (!longest) return src;
    const scale = RASTER_SIZE / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return src;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const bounds = contentBounds(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    );
    if (!bounds) return src;
    const output = document.createElement("canvas");
    output.width = bounds.width;
    output.height = bounds.height;
    output
      .getContext("2d")
      ?.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    return output.toDataURL("image/png");
  } catch (error) {
    console.warn("No se pudo ajustar el logo:", error);
    return src;
  }
}
