import type { FlyerTheme } from "./theme";
import type { FlyerAsset, FlyerSlots, FlyerTone, SlotSpec } from "./types";

export interface TemplateContext {
  slots: FlyerSlots;
  theme: FlyerTheme;
  width: number;
  height: number;
  brandName: string;
  website: string;
  /** Logo listo para el fondo del diseño, o nulo si la marca no tiene. */
  logoUrl: string | null;
  /** Versiones para diseños con zonas de distinto color. */
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  assetUrl: string | null;
}

export interface FlyerTemplate {
  id: string;
  name: string;
  /** Para qué sirve: lo lee el director creativo al elegir. */
  purpose: string;
  asset: FlyerAsset;
  /** Encuadre que necesita el recurso, en inglés, para el modelo de imagen. */
  assetGuide?: string;
  tones: readonly FlyerTone[];
  slots: readonly SlotSpec[];
  render: (context: TemplateContext) => { css: string; body: string };
}

/** Todo texto que llega al diseño pasa por acá. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function text(context: TemplateContext, key: string): string {
  const value = context.slots[key];
  return typeof value === "string" ? escapeHtml(value) : "";
}

export function list(context: TemplateContext, key: string): string[] {
  const value = context.slots[key];
  return Array.isArray(value) ? value.flatMap((item) => (typeof item === "string" ? [escapeHtml(item)] : [])) : [];
}

export function table(context: TemplateContext, key: string): string[][] {
  const value = context.slots[key];
  return Array.isArray(value)
    ? value.flatMap((row) => (Array.isArray(row) ? [row.map((cell) => escapeHtml(cell))] : []))
    : [];
}

export function brandMark(context: TemplateContext, logo: string | null = context.logoUrl): string {
  const image = logo ? `<img src="${logo}" alt="">` : "";
  return `<div class="brand">${image}<span>${escapeHtml(context.brandName)}</span></div>`;
}

export function header(context: TemplateContext, label = ""): string {
  return `<header>${brandMark(context)}${label ? `<span class="label">${label}</span>` : ""}</header>`;
}

export function footer(context: TemplateContext, body: string): string {
  const site = context.website ? `<b><small>Escribinos</small>${escapeHtml(context.website)}</b>` : "";
  return `<footer><p>${body}</p>${site}</footer>`;
}

/** Estilos comunes. Los diseños solo agregan lo propio. */
export function baseCss(context: TemplateContext, font: string): string {
  const { theme, width, height } = context;
  return `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${width}px;height:${height}px;overflow:hidden}
:root{--bg:${theme.bg};--fg:${theme.fg};--muted:${theme.muted};--accent:${theme.accent};--on-accent:${theme.onAccent};--ink:${theme.ink};--deep:${theme.deep};--paper:${theme.paper};--line:${theme.line}}
body{background:var(--bg);color:var(--fg);font-family:'Inter Tight',sans-serif;position:relative;text-rendering:geometricPrecision;font-kerning:normal;overflow-wrap:normal}
h1,.display{font-family:'${font}','Inter Tight',sans-serif;font-weight:700;letter-spacing:-.035em;line-height:.94;text-wrap:balance}
.page{position:absolute;inset:0;padding:58px 60px;display:flex;flex-direction:column;gap:34px}
main{flex:1;min-height:0;display:flex;flex-direction:column}
header,footer{display:flex;justify-content:space-between;align-items:center;gap:40px;flex:none}
footer{align-items:flex-end}
.brand{display:flex;align-items:center;gap:18px;font-weight:600;font-size:30px;letter-spacing:-.01em;white-space:nowrap}
.brand img{height:44px;width:auto;max-width:170px;object-fit:contain}
.label{font-size:27px;font-weight:500}
footer p{font-size:37px;line-height:1.17;font-weight:500;letter-spacing:-.012em;max-width:690px;text-wrap:balance}
footer b{font-size:29px;font-weight:600;white-space:nowrap;text-align:right}
footer b small{display:block;font-size:24px;font-weight:500;opacity:.8;margin-bottom:2px}
.fill{position:absolute;inset:0}
`;
}

/**
 * Achica los textos marcados con data-fit hasta que entren.
 * data-fit es la altura máxima, como proporción del flyer. data-shrink reduce
 * un bloque entero hasta que entra en su contenedor.
 */
export const FIT_SCRIPT = `
document.fonts.ready.then(function(){
  document.querySelectorAll('[data-fit]').forEach(function(el){
    var limit=parseFloat(el.dataset.fit)*window.innerHeight;
    var size=parseFloat(getComputedStyle(el).fontSize);
    var min=size*0.35;
    while(size>min&&(el.scrollWidth>el.clientWidth+1||el.getBoundingClientRect().height>limit)){
      size=size*0.97;el.style.fontSize=size+'px';
    }
  });
  document.querySelectorAll('[data-shrink]').forEach(function(el){
    var zoom=1;
    while(zoom>0.45&&el.getBoundingClientRect().height>el.parentElement.clientHeight){
      zoom=zoom-0.03;el.style.zoom=zoom;
    }
  });
});`;
