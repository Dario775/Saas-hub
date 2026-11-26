import type { FlyerExport, MeasuredText } from "@/lib/flyers/flyer-layers";
import type { BackgroundLayer, BrandLogoLayer, CanvasLayer, TextLayer } from "./types";

/** Diseño completo que se abre en el editor. */
export interface ComposerDesign {
  aspectRatio: "4:5" | "1:1" | "9:16";
  layers: CanvasLayer[];
}

const BASE = { visible: true, locked: false, opacity: 1, blendMode: "normal", rotation: 0 } as const;

function layerName(text: string): string {
  const first = text.replace(/\s+/g, " ").trim();
  return first.length > 28 ? `${first.slice(0, 27)}…` : first;
}

export function textLayerFrom(measured: MeasuredText, index: number): TextLayer {
  const lines = measured.text.split("\n").length;
  const height = Math.max(measured.lineHeight * lines, measured.fontSize);
  const width = Math.max(1, measured.right - measured.left);
  return {
    ...BASE,
    id: `flyer-text-${index}`,
    opacity: measured.opacity,
    name: layerName(measured.text),
    type: "text",
    x: Math.round(measured.left),
    y: Math.round(measured.center - height / 2),
    width: Math.ceil(width),
    height: Math.ceil(height),
    text: measured.text,
    fontFamily: measured.fontFamily,
    fontSize: Math.round(measured.fontSize * 10) / 10,
    fontWeight: measured.fontWeight,
    fontStyle: measured.fontStyle,
    color: measured.color,
    textAlign: measured.align,
    letterSpacing: Math.round(measured.letterSpacing * 100) / 100,
    lineHeight: Math.round((measured.lineHeight / measured.fontSize) * 1000) / 1000,
    textTransform: "none",
  };
}

/** Convierte un flyer exportado en capas del editor, en el mismo orden visual. */
export function designFromFlyer(exported: FlyerExport): ComposerDesign {
  const background: BackgroundLayer = {
    ...BASE,
    id: "bg-default",
    name: "Fondo del flyer",
    type: "background",
    locked: true,
    x: 0,
    y: 0,
    width: exported.width,
    height: exported.height,
    fillType: "image",
    color: "#000000",
    imageUrl: exported.background,
  };
  const logos: BrandLogoLayer[] = exported.logos.map((logo, index) => ({
    ...BASE,
    id: `flyer-logo-${index}`,
    name: "Logo de Marca",
    type: "brand-logo",
    x: Math.round(logo.left),
    y: Math.round(logo.top),
    width: Math.round(logo.width),
    height: Math.round(logo.height),
    brandId: "flyer",
    variant: "original",
    customDataUrl: logo.src,
  }));
  return {
    aspectRatio: exported.format,
    layers: [background, ...logos, ...exported.texts.map(textLayerFrom)],
  };
}
