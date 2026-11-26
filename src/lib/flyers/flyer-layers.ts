/** Lo que el navegador mide de un flyer para llevarlo al editor de capas. */
export interface MeasuredText {
  text: string;
  left: number;
  right: number;
  /** Centro vertical del bloque de líneas. */
  center: number;
  lineHeight: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  color: string;
  letterSpacing: number;
  align: "left" | "center" | "right";
  /** Opacidad efectiva, sumando la de los contenedores. */
  opacity: number;
}

export interface MeasuredLogo {
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlyerMeasurements {
  texts: MeasuredText[];
  logos: MeasuredLogo[];
}

/** Paquete que recibe el editor: fondo sin textos y las piezas editables. */
export interface FlyerExport extends FlyerMeasurements {
  format: "4:5" | "1:1" | "9:16";
  width: number;
  height: number;
  /** Fondo en JPEG, en data URL. */
  background: string;
}

const MAX_TEXTS = 60;
const MAX_TEXT = 400;

function finite(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Lee lo que dejó el navegador. Descarta lo que no tenga forma de medida. */
export function parseMeasurements(base64: string): FlyerMeasurements {
  const raw = JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as Partial<FlyerMeasurements>;
  const texts = (Array.isArray(raw.texts) ? raw.texts : [])
    .filter((item) => item && typeof item.text === "string" && item.text.trim() && finite(item.fontSize) > 0)
    .slice(0, MAX_TEXTS)
    .map((item) => ({
      text: item.text.slice(0, MAX_TEXT),
      left: finite(item.left),
      right: finite(item.right),
      center: finite(item.center),
      lineHeight: finite(item.lineHeight, finite(item.fontSize) * 1.2),
      fontSize: finite(item.fontSize),
      fontFamily: typeof item.fontFamily === "string" ? item.fontFamily.slice(0, 60) : "Inter Tight",
      fontWeight: finite(item.fontWeight, 400),
      fontStyle: item.fontStyle === "italic" ? ("italic" as const) : ("normal" as const),
      color: typeof item.color === "string" ? item.color.slice(0, 40) : "#ffffff",
      letterSpacing: finite(item.letterSpacing),
      align: item.align === "center" || item.align === "right" ? item.align : ("left" as const),
      opacity: Math.min(1, Math.max(0, finite(item.opacity, 1))),
    }));
  const logos = (Array.isArray(raw.logos) ? raw.logos : [])
    .filter((item) => item && typeof item.src === "string" && item.src.startsWith("data:image/") && finite(item.width) > 0)
    .slice(0, 3)
    .map((item) => ({ src: item.src, left: finite(item.left), top: finite(item.top), width: finite(item.width), height: finite(item.height) }));
  return { texts, logos };
}
