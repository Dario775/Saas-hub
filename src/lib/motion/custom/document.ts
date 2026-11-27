import { escapeHtml } from "../../flyers/template";
import { fontUrl } from "../../flyers/theme";
import { COMPOSITION_ID, MOTION_FILES } from "../motion-html";
import { STAGE_ID } from "./prompt";
import type { Design } from "./validate";

/**
 * Política de seguridad del documento: aunque el control previo fallara, el
 * código generado no puede conectarse a ningún lado salvo a las fuentes.
 */
export const CUSTOM_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export interface CustomDocument {
  design: Design;
  width: number;
  height: number;
  duration: number;
  font: string;
  title: string;
}

/** Composición de HyperFrames con el diseño de Claude adentro. */
export function buildCustomHtml({ design, width, height, duration, font, title }: CustomDocument): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CUSTOM_CSP}">
<meta name="viewport" content="width=${width}, height=${height}">
<title>${escapeHtml(title)}</title><link rel="stylesheet" href="${escapeHtml(fontUrl(font))}">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${width}px;height:${height}px;overflow:hidden;background:#000}
#root{position:relative;overflow:hidden}
.clip{position:absolute;inset:0;overflow:hidden}
#${STAGE_ID}{position:relative;width:${width}px;height:${height}px;overflow:hidden;font-family:'Inter Tight',sans-serif;text-rendering:geometricPrecision}
${design.css}
</style>
<script src="${MOTION_FILES.gsap}"></script></head><body>
<div id="root" data-composition-id="${COMPOSITION_ID}" data-width="${width}" data-height="${height}" data-duration="${duration}" style="width:${width}px;height:${height}px">
<section id="scene" class="clip" data-start="0" data-duration="${duration}" data-track-index="1"><div id="${STAGE_ID}">${design.html}</div></section>
</div>
<script>
${design.script}
</script>
</body></html>`;
}
