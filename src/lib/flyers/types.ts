export type FlyerTone = "claro" | "oscuro" | "acento";
export const FLYER_TONES: readonly FlyerTone[] = ["claro", "oscuro", "acento"];

export type FlyerFormat = "4:5" | "1:1" | "9:16";
export const FLYER_SIZES: Record<FlyerFormat, { width: number; height: number }> = {
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
};

export type SlotValue = string | string[] | string[][];
export type FlyerSlots = Record<string, SlotValue>;

export interface SlotSpec {
  key: string;
  label: string;
  kind: "text" | "list" | "table";
  /** Largo máximo de cada texto. */
  max: number;
  /** Cantidad de elementos (listas) o filas (tablas). */
  items?: [number, number];
  /** Columnas de cada fila (tablas). */
  columns?: number;
  optional?: boolean;
}

/** Recurso visual que pide el diseño. Sin recurso, el flyer es diseño puro. */
export type FlyerAsset = "foto" | "objeto" | null;

export interface FlyerBrand {
  id: string;
  name: string;
  website: string;
  description: string;
  audience: string;
  valueProposition: string;
  voice: string;
  primary: string;
  accent: string;
  headingFont: string;
  logoDataUrl?: string;
}

export interface FlyerConcept {
  template: string;
  tone: FlyerTone;
  /** Por qué esta idea le importa al cliente. */
  idea: string;
  slots: FlyerSlots;
  assetPrompt?: string;
  caption: string;
}

export interface FlyerReview {
  score: number;
  approved: boolean;
  problems: string[];
}

export type FlyerVideoStatus = "running" | "done" | "failed";

/** Versión animada del flyer. */
export interface FlyerVideo {
  status: FlyerVideoStatus;
  seconds: number;
  /** Con sonido: ritmo y efectos generados, más la música propia si hay. */
  music: boolean;
  /** Si usó una pista de la carpeta de música. */
  track?: boolean;
  /** Ruta pública del MP4, lista para mostrar y publicar. */
  url?: string;
  error?: string;
}

export interface Flyer {
  id: string;
  concept: FlyerConcept;
  format: FlyerFormat;
  review?: FlyerReview;
  hasAsset: boolean;
  /** Cambia con cada render, para no mostrar una imagen vieja. */
  revision: number;
  error?: string;
  video?: FlyerVideo;
}

export type FlyerJobStatus = "running" | "done" | "failed";

export interface FlyerJob {
  id: string;
  brandId: string;
  brief: string;
  format: FlyerFormat;
  model: string;
  status: FlyerJobStatus;
  step: string;
  error?: string;
  createdAt: string;
  flyers: Flyer[];
}
