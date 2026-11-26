import type { FlyerBrand, FlyerTone } from "./types";

type Rgb = [number, number, number];

const PAPER = "#f3f0e9";
const DEFAULT_PRIMARY = "#0f172a";
const DEFAULT_FONT = "Inter Tight";

/** Fuentes probadas, con los pesos que publica Google Fonts. */
const FONTS: Record<string, string> = {
  "Inter Tight": "Inter+Tight:wght@400;500;600;700;800",
  "Playfair Display": "Playfair+Display:wght@400;500;600;700;800",
  "Space Grotesk": "Space+Grotesk:wght@400;500;600;700",
  Outfit: "Outfit:wght@400;500;600;700;800",
  Poppins: "Poppins:wght@400;500;600;700;800",
  Oswald: "Oswald:wght@400;500;600;700",
};

export function parseHex(value: string | undefined, fallback = DEFAULT_PRIMARY): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec((value || "").trim());
  const hex = match ? match[1] : fallback.slice(1);
  return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return "#" + rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("");
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return from.map((channel, index) => channel + (to[index] - channel) * amount) as Rgb;
}

export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(parseHex(a)), luminance(parseHex(b))].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Color de texto que mejor se lee sobre un fondo. */
export function readableOn(background: string, dark: string, light = "#ffffff"): string {
  return contrast(background, dark) >= contrast(background, light) ? dark : light;
}

export function displayFont(heading: string): string {
  return FONTS[heading] ? heading : DEFAULT_FONT;
}

export function fontUrl(font: string): string {
  const families = [...new Set([FONTS[font] || FONTS[DEFAULT_FONT], FONTS[DEFAULT_FONT]])];
  return `https://fonts.googleapis.com/css2?${families.map((family) => `family=${family}`).join("&")}&display=block`;
}

export interface FlyerTheme {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  onAccent: string;
  ink: string;
  deep: string;
  paper: string;
  line: string;
  /** El fondo es oscuro: el logo va en blanco. */
  dark: boolean;
}

/** Colores del flyer según la marca y el tono. Garantiza texto legible. */
export function buildTheme(brand: Pick<FlyerBrand, "primary" | "accent">, tone: FlyerTone): FlyerTheme {
  const primary = parseHex(brand.primary);
  const ink = toHex(mix(primary, [2, 6, 12], 0.86));
  const deep = toHex(mix(primary, [0, 10, 24], luminance(primary) > 0.12 ? 0.62 : 0.15));
  const accent = toHex(parseHex(brand.accent, toHex(primary)));
  const bg = tone === "claro" ? PAPER : tone === "oscuro" ? ink : accent;
  const fg = tone === "claro" ? deep : tone === "oscuro" ? "#ffffff" : readableOn(accent, ink);
  const fgRgb = parseHex(fg);
  const bgRgb = parseHex(bg);
  return {
    bg,
    fg,
    muted: toHex(mix(fgRgb, bgRgb, 0.28)),
    accent,
    onAccent: readableOn(accent, ink),
    ink,
    deep,
    paper: PAPER,
    line: toHex(mix(bgRgb, fgRgb, 0.16)),
    dark: luminance(bgRgb) < 0.2,
  };
}
