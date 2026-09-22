export const SUPPORTED_PLATFORMS = ["facebook", "instagram", "linkedin", "x"] as const;
export type PlatformType = (typeof SUPPORTED_PLATFORMS)[number];

export function validatePlatforms(platforms: unknown): void {
  if (platforms !== undefined) {
    if (!Array.isArray(platforms) || platforms.length === 0) {
      throw new Error("Seleccioná al menos una red social válida.");
    }
    const invalid = platforms.filter(
      (p) => !SUPPORTED_PLATFORMS.includes(p as PlatformType),
    );
    if (invalid.length > 0) {
      throw new Error(
        `Redes no soportadas: ${invalid.join(", ")}. Redes disponibles: ${SUPPORTED_PLATFORMS.join(", ")}.`,
      );
    }
  }
}
export function validateScheduleDate(value: unknown, now = Date.now()): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new Error("Seleccioná una fecha y hora válidas.");
  if (Date.parse(value) <= now)
    throw new Error("La fecha de publicación debe estar en el futuro.");
  return new Date(value).toISOString();
}
export function decodeImage(value: unknown): Buffer {
  if (
    typeof value !== "string" ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value)
  )
    throw new Error("Subí una imagen PNG, JPEG o WebP válida.");
  if (value.length > 14_000_000)
    throw new Error("La imagen supera el límite de 10 MB.");
  const buffer = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
  if (!buffer.length) throw new Error("La imagen está vacía.");
  return buffer;
}
