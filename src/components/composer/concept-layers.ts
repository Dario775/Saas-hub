import type { BrandLogoLayer, CanvasLayer, ShapeLayer, TextLayer } from "./types";

/** Textos de un concepto del Estudio que el editor convierte en capas. */
export interface ConceptCopy {
  headline: string;
  subtitle?: string;
  cta?: string;
  /** Proporción con la que se generó el fondo. */
  aspectRatio?: string;
}

export interface ConceptLayerOptions {
  copy: ConceptCopy;
  width: number;
  height: number;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  logoId: string;
  logoDataUrl?: string;
  brandName?: string;
  website?: string;
}

const BASE = { visible: true, locked: false, opacity: 1, blendMode: "normal", rotation: 0 } as const;
/** Ancho medio de una letra en negrita, en proporción al tamaño de fuente. */
const GLYPH_RATIO = 0.6;
const HEADLINE_LINE_HEIGHT = 1.05;
const MAX_HEADLINE_LINES = 3;

/** Parte el texto en líneas que entren en el ancho disponible. */
export function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const maxChars = Math.max(4, Math.floor(maxWidth / (fontSize * GLYPH_RATIO)));
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + " " + word).length <= maxChars) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines;
}

/** Achica el titular hasta que entre en pocas líneas y ninguna palabra se corte. */
export function fitHeadline(text: string, maxWidth: number, startSize: number): { fontSize: number; lines: string[] } {
  let fontSize = startSize;
  for (;;) {
    const lines = wrapText(text, fontSize, maxWidth);
    const widest = Math.max(...lines.map((line) => line.length)) * fontSize * GLYPH_RATIO;
    if ((lines.length <= MAX_HEADLINE_LINES && widest <= maxWidth) || fontSize <= startSize * 0.4)
      return { fontSize, lines };
    fontSize = Math.round(fontSize * 0.92);
  }
}

function textLayer(layer: Partial<TextLayer> & Pick<TextLayer, "id" | "name" | "x" | "y" | "width" | "height" | "text" | "fontFamily" | "fontSize">): TextLayer {
  return {
    ...BASE,
    type: "text",
    fontWeight: 700,
    fontStyle: "normal",
    color: "#ffffff",
    textAlign: "left",
    letterSpacing: 0,
    lineHeight: 1.25,
    textTransform: "none",
    ...layer,
  };
}

/** Capas editables de titular, bajada, botón y logo, sobre un fondo generado. */
export function createConceptLayers(options: ConceptLayerOptions): CanvasLayer[] {
  const { copy, width, height } = options;
  const unit = Math.min(width, height);
  const margin = Math.round(unit * 0.07);
  const contentWidth = width > height ? Math.round(width * 0.55) : width - margin * 2;

  const headline = fitHeadline(copy.headline, contentWidth, Math.round(unit * 0.1));
  const headlineHeight = Math.round(headline.lines.length * headline.fontSize * HEADLINE_LINE_HEIGHT);
  const logoSize = Math.round(unit * 0.1);
  const headlineY = margin + logoSize + Math.round(margin * 0.6);

  const bodySize = Math.round(unit * 0.034);
  const subtitleLines = copy.subtitle ? wrapText(copy.subtitle, bodySize, contentWidth) : [];
  const subtitleHeight = Math.round(subtitleLines.length * bodySize * 1.25);
  const subtitleY = headlineY + headlineHeight + Math.round(margin * 0.3);

  const shadeHeight = Math.min(height, subtitleY + subtitleHeight + margin * 2);
  const shade: ShapeLayer = {
    ...BASE,
    id: "concept-shade",
    name: "Contraste para el texto",
    type: "shape",
    shapeType: "gradient-overlay",
    x: 0,
    y: 0,
    width,
    height: shadeHeight,
    fillType: "gradient",
    fillColor: "rgba(4,8,20,0.85)",
    gradientEnd: "rgba(4,8,20,0)",
    gradientAngle: 90,
  };
  const footHeight = Math.round(unit * 0.3);
  const footShade: ShapeLayer = {
    ...shade,
    id: "concept-foot-shade",
    name: "Contraste inferior",
    y: height - footHeight,
    height: footHeight,
    fillColor: "rgba(4,8,20,0)",
    gradientEnd: "rgba(4,8,20,0.9)",
  };
  const plate: ShapeLayer = {
    ...BASE,
    id: "concept-logo-plate",
    name: "Base del logo",
    type: "shape",
    shapeType: "rectangle",
    x: margin,
    y: margin,
    width: logoSize,
    height: logoSize,
    fillType: "solid",
    fillColor: "#ffffff",
    borderRadius: Math.round(logoSize * 0.22),
  };
  const inset = Math.round(logoSize * 0.15);
  const logo: BrandLogoLayer = {
    ...BASE,
    id: "logo-default",
    name: "Logo de Marca",
    type: "brand-logo",
    x: margin + inset,
    y: margin + inset,
    width: logoSize - inset * 2,
    height: logoSize - inset * 2,
    brandId: options.logoId,
    variant: "original",
    customDataUrl: options.logoDataUrl,
  };

  const layers: CanvasLayer[] = [
    shade,
    footShade,
    plate,
    logo,
    textLayer({
      id: "title-default",
      name: "Titular Principal",
      x: margin,
      y: headlineY,
      width: contentWidth,
      height: headlineHeight,
      text: headline.lines.join("\n"),
      fontFamily: options.headingFont,
      fontSize: headline.fontSize,
      fontWeight: 900,
      lineHeight: HEADLINE_LINE_HEIGHT,
    }),
  ];
  if (options.brandName) {
    const nameX = margin + logoSize + Math.round(margin * 0.35);
    layers.push(
      textLayer({
        id: "brand-name",
        name: "Nombre de la marca",
        x: nameX,
        y: margin,
        width: width - nameX - margin,
        height: logoSize,
        text: options.brandName,
        fontFamily: options.headingFont,
        fontSize: Math.round(unit * 0.036),
      }),
    );
  }
  if (options.website)
    layers.push(
      textLayer({
        id: "brand-website",
        name: "Sitio web",
        x: Math.round(width / 2),
        y: height - margin - bodySize * 2,
        width: Math.round(width / 2) - margin,
        height: Math.round(bodySize * 1.4),
        text: options.website.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        fontFamily: options.bodyFont,
        fontSize: Math.round(bodySize * 0.85),
        textAlign: "right",
        shadowBlur: 14,
        shadowColor: "rgba(0,0,0,0.85)",
      }),
    );
  if (subtitleLines.length)
    layers.push(
      textLayer({
        id: "subtitle-default",
        name: "Subtítulo / Bajada",
        x: margin,
        y: subtitleY,
        width: contentWidth,
        height: subtitleHeight,
        text: subtitleLines.join("\n"),
        fontFamily: options.bodyFont,
        fontSize: bodySize,
        color: "#e2e8f0",
      }),
    );
  if (copy.cta) {
    const paddingX = Math.round(bodySize * 1.1);
    const paddingY = Math.round(bodySize * 0.6);
    const ctaWidth = Math.round(copy.cta.length * bodySize * GLYPH_RATIO);
    layers.push(
      textLayer({
        id: "cta-default",
        name: "Llamado a la acción",
        // El editor centra la caja del botón en la capa: el texto va centrado.
        x: margin + paddingX,
        y: height - margin - bodySize * 2,
        width: ctaWidth,
        height: Math.round(bodySize * 1.4),
        text: copy.cta,
        fontFamily: options.bodyFont,
        fontSize: bodySize,
        color: "#06121f",
        textAlign: "center",
        boxBackground: {
          enabled: true,
          color: options.accentColor,
          opacity: 1,
          paddingX,
          paddingY,
          borderRadius: Math.round(bodySize * 1.2),
        },
      }),
    );
  }
  return layers;
}
