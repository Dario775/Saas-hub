export interface RenderSize {
  width: number;
  height: number;
}

/** Cerca de 1 megapíxel y múltiplos de 16: el punto de trabajo de los modelos locales. */
export const RENDER_SIZES: Record<string, RenderSize> = {
  "1:1": { width: 1088, height: 1088 },
  "9:16": { width: 816, height: 1440 },
  "4:5": { width: 960, height: 1200 },
  "16:9": { width: 1440, height: 816 },
};

const TARGET_PIXELS = 1088 * 1088;
const STEP = 16;

export function renderSizeForAspect(aspect?: string): RenderSize {
  return RENDER_SIZES[aspect || ""] || RENDER_SIZES["1:1"];
}

/** Tamaño de generación con la misma proporción que un lienzo cualquiera. */
export function renderSizeForCanvas(width: number, height: number): RenderSize {
  if (!(width > 0) || !(height > 0)) return RENDER_SIZES["1:1"];
  const scale = Math.sqrt(TARGET_PIXELS / (width * height));
  const round = (value: number) => Math.max(256, Math.round((value * scale) / STEP) * STEP);
  return { width: round(width), height: round(height) };
}
