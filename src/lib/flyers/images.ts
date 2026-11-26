import sharp from "sharp";

const ALPHA_FLOOR = 16;
const ALPHA_CEIL = 240;
const MIN_OPAQUE = 0.03;
const MAX_OPAQUE = 0.97;
const LOGO_SIZE = 480;

export interface LogoVariants {
  /** Para fondos claros: los colores originales. */
  dark: string;
  /** Para fondos oscuros: en blanco. */
  light: string;
}

function toDataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

/** Prepara el logo: sin margen propio y con versión en blanco para fondos oscuros. */
export async function prepareLogo(dataUrl: string | undefined): Promise<LogoVariants | null> {
  const match = /^data:image\/[\w.+-]+;base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  try {
    const source = Buffer.from(match[1], "base64");
    const trimmed = await sharp(source, { density: 300 })
      .ensureAlpha()
      .trim({ threshold: 5 })
      .resize({ width: LOGO_SIZE, height: LOGO_SIZE, fit: "inside" })
      .png()
      .toBuffer();
    const { data, info } = await sharp(trimmed).raw().toBuffer({ resolveWithObject: true });
    let opaque = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] > 128) opaque += 1;
    // Un logo sin transparencia no se puede pintar de blanco: quedaría un bloque.
    if (opaque / (data.length / 4) > MAX_OPAQUE) return { dark: toDataUrl(trimmed), light: toDataUrl(trimmed) };
    const white = Buffer.from(data);
    for (let index = 0; index < white.length; index += 4) white.fill(255, index, index + 3);
    const light = await sharp(white, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    return { dark: toDataUrl(trimmed), light: toDataUrl(light) };
  } catch (error) {
    console.warn("[Flyers] No se pudo preparar el logo:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Limpia el alfa de un objeto y recorta el aire. Nulo si salió vacío o sin recortar. */
export async function cleanObject(png: Buffer): Promise<Buffer | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  const clean = Buffer.from(data);
  for (let index = 3; index < clean.length; index += 4) {
    const alpha = clean[index];
    clean[index] =
      alpha <= ALPHA_FLOOR ? 0 : alpha >= ALPHA_CEIL ? 255 : Math.round(((alpha - ALPHA_FLOOR) / (ALPHA_CEIL - ALPHA_FLOOR)) * 255);
    if (clean[index] > 128) opaque += 1;
  }
  const ratio = opaque / (clean.length / 4);
  if (ratio < MIN_OPAQUE || ratio > MAX_OPAQUE) return null;
  return sharp(clean, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

/** Copia liviana para que Claude la revise. */
export async function reviewCopy(png: Buffer): Promise<Buffer> {
  return sharp(png).resize({ width: 1080, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 86 }).toBuffer();
}

/** Fondo para el editor: JPEG de alta calidad, liviano para guardar en el navegador. */
export async function backgroundJpeg(png: Buffer): Promise<Buffer> {
  return sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
}

/** Achica el PNG si supera lo que se puede publicar. */
export async function fitForPublishing(png: Buffer, maxBytes = 6_900_000): Promise<Buffer> {
  let result = png;
  let width = (await sharp(png).metadata()).width || 2160;
  while (result.length > maxBytes && width > 1080) {
    width = Math.max(1080, Math.round(width * 0.85));
    result = await sharp(png).resize({ width, kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
  }
  return result;
}
