/**
 * Estilos de video: cada uno define el tempo (que mueve la animación) y la
 * música generada. Sin dependencias de Node: lo usan el servidor y el panel.
 */
export const MOTION_STYLES = {
  energetico: { label: "Enérgico", bpm: 124, description: "Electrónico, bombo en cada tiempo" },
  equilibrado: { label: "Equilibrado", bpm: 110, description: "Pop, golpes y acordes" },
  corporativo: { label: "Corporativo", bpm: 100, description: "Arpegios limpios, sin estridencias" },
  tranquilo: { label: "Tranquilo", bpm: 84, description: "Lo-fi suave, para leer con calma" },
} as const;

export type MotionStyle = keyof typeof MOTION_STYLES;
/**
 * "medida": Claude diseña la animación completa de cada video (la música
 * sale de un estilo elegido al azar). "auto": coreografía fija, estilo al azar.
 */
export const CUSTOM_STYLE = "medida";
export type MotionStyleChoice = MotionStyle | "auto" | typeof CUSTOM_STYLE;

export const STYLE_IDS = Object.keys(MOTION_STYLES) as MotionStyle[];

export function isMotionStyle(value: unknown): value is MotionStyle {
  return typeof value === "string" && value in MOTION_STYLES;
}

export function readStyleChoice(value: unknown): MotionStyleChoice {
  if (value === CUSTOM_STYLE) return CUSTOM_STYLE;
  return isMotionStyle(value) ? value : "auto";
}

/** Nombre para mostrar de cualquier opción. */
export function styleLabel(choice: MotionStyleChoice): string {
  if (choice === CUSTOM_STYLE) return "A medida (diseñado por Claude)";
  if (choice === "auto") return "Automático";
  return MOTION_STYLES[choice].label;
}

/** Número estable a partir de un texto (FNV-1a), igual en servidor y navegador. */
export function seedNumber(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** "auto" y "medida" eligen el estilo musical por semilla: la misma semilla, el mismo estilo. */
export function resolveStyle(choice: MotionStyleChoice, seed: string): MotionStyle {
  return isMotionStyle(choice) ? choice : STYLE_IDS[seedNumber(seed) % STYLE_IDS.length];
}
