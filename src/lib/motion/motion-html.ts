import { baseCss, escapeHtml, FIT_SCRIPT, type FlyerTemplate, type TemplateContext } from "../flyers/template";
import { fontUrl, readableOn } from "../flyers/theme";

/** Id de la composición: también es la clave de su línea de tiempo. */
export const COMPOSITION_ID = "flyer";
/** Lo que dura la placa final con la marca (se ajusta al tiempo más cercano). */
export const OUTRO_SECONDS = 2.5;
/** Tempo de la animación y del sonido: todo cae en un tiempo de 0,5 s. */
export const MOTION_BPM = 120;
/**
 * Gancho: el titular en grande durante el primer compás. A partir de `scene`
 * se arma el flyer y en `land` las palabras terminan de llegar a su lugar.
 */
export const MOTION_HOOK = { scene: 2, land: 2.5 } as const;
export const MIN_SECONDS = 6;
export const MAX_SECONDS = 20;

/** Archivos que el video carga desde su carpeta de trabajo. */
export const MOTION_FILES = {
  gsap: "gsap.min.js",
  choreography: "choreography.js",
} as const;

export interface MotionOptions {
  /** Duración total en segundos, placa final incluida. */
  duration: number;
  /** Texto de la llamada a la acción de la placa final. */
  cta: string;
}

export interface MotionTiming {
  duration: number;
  outroStart: number;
}

export function motionTiming(duration: number): MotionTiming {
  const total = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Number.isFinite(duration) ? duration : MIN_SECONDS));
  // La marca entra justo en un tiempo, como el golpe del sonido.
  const beat = 60 / MOTION_BPM;
  const outroStart = Math.round((total - OUTRO_SECONDS) / beat) * beat;
  return { duration: total, outroStart: Number(outroStart.toFixed(2)) };
}

const MOTION_CSS = `
#root{position:relative;overflow:hidden}
.clip{position:absolute;inset:0;overflow:hidden}
.backdrop{position:absolute;inset:0;background:var(--bg)}
.mw{display:inline-block;will-change:transform}
.page{transform-origin:50% 45%}
.hook{position:absolute;inset:0;z-index:40;pointer-events:none}
.hook-bg{position:absolute;inset:0}
.hook-measure{position:absolute;inset:0;display:flex;flex-wrap:wrap;justify-content:center;align-content:center;padding:0 8%;visibility:hidden}
.hw{position:absolute;display:block;transform-origin:0 0;z-index:1}
.hw>span{display:inline-block}
.iris{position:absolute;border-radius:50%;z-index:50}
.outro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;text-align:center;padding:80px}
.outro img{height:180px;width:auto;max-width:72%;object-fit:contain}
.out-name{font-weight:700;letter-spacing:-.03em;line-height:1}
.out-cta{font-size:40px;font-weight:500;opacity:.85}
.out-site{font-size:46px;font-weight:700;letter-spacing:-.01em}
`;

function outroHtml(context: TemplateContext, cta: string): string {
  const { theme } = context;
  // La placa usa el color de acento: el logo va en la versión que se lee mejor.
  const onAccent = readableOn(theme.accent, theme.ink);
  const light = onAccent === "#ffffff";
  const logo = light ? context.logoLightUrl : context.logoDarkUrl;
  const nameSize = logo ? 64 : 120;
  return `<div class="outro" style="background:${theme.accent};color:${onAccent}">${
    logo ? `<img src="${logo}" alt="">` : ""
  }<div class="out-name" style="font-size:${nameSize}px">${escapeHtml(context.brandName)}</div>${
    cta ? `<div class="out-cta">${escapeHtml(cta)}</div>` : ""
  }${context.website ? `<div class="out-site">${escapeHtml(context.website)}</div>` : ""}</div>`;
}

/**
 * Documento de HyperFrames para un flyer animado. Reutiliza el diseño del
 * flyer tal cual y le suma la coreografía, la placa final y la música.
 */
export function buildMotionHtml(template: FlyerTemplate, context: TemplateContext, font: string, options: MotionOptions): string {
  const { duration, outroStart } = motionTiming(options.duration);
  const { css, body } = template.render(context);
  const { width, height } = context;
  const config = JSON.stringify({
    id: COMPOSITION_ID,
    template: template.id,
    duration,
    bpm: MOTION_BPM,
    accent: context.theme.accent,
    hook: MOTION_HOOK,
    outro: { start: outroStart },
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=${width}, height=${height}">
<title>${escapeHtml(context.brandName)}</title><link rel="stylesheet" href="${escapeHtml(fontUrl(font))}">
<style>${baseCss(context, font)}${css}${MOTION_CSS}</style>
<script src="${MOTION_FILES.gsap}"></script></head><body>
<div id="root" data-composition-id="${COMPOSITION_ID}" data-width="${width}" data-height="${height}" data-duration="${duration}" style="width:${width}px;height:${height}px">
<section id="scene" class="clip" data-start="0" data-duration="${duration}" data-track-index="1"><div class="backdrop"></div>${body}</section>
<section id="end" class="clip" data-start="${outroStart}" data-duration="${(duration - outroStart).toFixed(2)}" data-track-index="2">${outroHtml(context, options.cta)}</section>
</div>
<script>${FIT_SCRIPT}</script><script>window.__MOTION=${config};</script><script src="${MOTION_FILES.choreography}"></script>
</body></html>`;
}
