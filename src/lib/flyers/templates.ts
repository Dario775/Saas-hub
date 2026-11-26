import { BACKGROUND_CSS, BACKGROUND_SCRIPT, LAYERS_SCRIPT, type FlyerRenderMode } from "./export-script";
import { baseCss, escapeHtml, FIT_SCRIPT, type FlyerTemplate, type TemplateContext } from "./template";
import { foto, objeto } from "./templates-asset";
import { chat, planilla, red, ventana } from "./templates-idea";
import { afirmacion, comparativa, oferta, pasos } from "./templates-type";
import { fontUrl } from "./theme";

export const FLYER_TEMPLATES: readonly FlyerTemplate[] = [
  planilla,
  chat,
  red,
  ventana,
  afirmacion,
  comparativa,
  pasos,
  oferta,
  foto,
  objeto,
];

export function findTemplate(id: string): FlyerTemplate | undefined {
  return FLYER_TEMPLATES.find((template) => template.id === id);
}

/**
 * Documento completo del flyer. La política de contenido solo permite las
 * fuentes y las imágenes locales: ningún texto puede cargar otra cosa.
 */
export function buildFlyerHtml(
  template: FlyerTemplate,
  context: TemplateContext,
  font: string,
  mode: FlyerRenderMode = "normal",
): string {
  const { css, body } = template.render(context);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'">
<title>${escapeHtml(context.brandName)}</title><link rel="stylesheet" href="${escapeHtml(fontUrl(font))}">
<style>${baseCss(context, font)}${css}${mode === "background" ? BACKGROUND_CSS : ""}</style></head><body>${body}<script>${FIT_SCRIPT}${mode === "layers" ? LAYERS_SCRIPT : mode === "background" ? BACKGROUND_SCRIPT : ""}</script></body></html>`;
}
