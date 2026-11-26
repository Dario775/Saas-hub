import { baseCss, escapeHtml, FIT_SCRIPT, type FlyerTemplate, type TemplateContext } from "../flyers/template";
import { fontUrl, readableOn } from "../flyers/theme";

/** Id de la composición: también es la clave de su línea de tiempo. */
export const COMPOSITION_ID = "flyer";
/** Mínimo que dura la placa final con la marca: se alarga hasta caer en un tiempo. */
export const OUTRO_SECONDS = 2.4;
/** Tempo por defecto (estilo equilibrado). Cada estilo trae el suyo. */
export const MOTION_BPM = 110;
const BEATS_PER_BAR = 4;
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
  /** Tempo del estilo elegido. */
  bpm?: number;
}

export interface MotionTiming {
  duration: number;
  bpm: number;
  outroStart: number;
  /**
   * Gancho: el titular en grande durante el primer compás. En `scene` se arma
   * el flyer y en `land` (un tiempo después) las palabras llegan a su lugar.
   */
  hook: { scene: number; land: number };
}

const round = (value: number) => Number(value.toFixed(3));

export function motionTiming(duration: number, bpm = MOTION_BPM): MotionTiming {
  const total = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Number.isFinite(duration) ? duration : MIN_SECONDS));
  const tempo = Number.isFinite(bpm) && bpm >= 60 && bpm <= 160 ? bpm : MOTION_BPM;
  const beat = 60 / tempo;
  // La marca entra justo en un tiempo, como el golpe del sonido, y se lee al menos OUTRO_SECONDS.
  const outroStart = Math.floor((total - OUTRO_SECONDS) / beat) * beat;
  return {
    duration: total,
    bpm: tempo,
    outroStart: round(outroStart),
    hook: { scene: round(beat * BEATS_PER_BAR), land: round(beat * (BEATS_PER_BAR + 1)) },
  };
}

const MOTION_CSS = `
#root{position:relative;overflow:hidden}
.clip{position:absolute;inset:0;overflow:hidden}
#scene{z-index:1}
#end{z-index:2}
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
.out-mark{position:relative;display:flex;align-items:center;justify-content:center;max-width:72%}
.out-mark img{position:relative;height:180px;width:auto;max-width:100%;object-fit:contain}
.out-ring{position:absolute;left:50%;top:50%;width:340px;height:340px;margin:-170px 0 0 -170px;border-radius:50%;border:6px solid currentColor;opacity:0}
.out-rule{width:140px;height:6px;border-radius:3px;background:currentColor;transform-origin:50% 50%}
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
    logo ? `<div class="out-mark"><span class="out-ring"></span><img src="${logo}" alt=""></div>` : ""
  }<div class="out-name" style="font-size:${nameSize}px">${escapeHtml(context.brandName)}</div><div class="out-rule"></div>${
    cta ? `<div class="out-cta">${escapeHtml(cta)}</div>` : ""
  }${context.website ? `<div class="out-site">${escapeHtml(context.website)}</div>` : ""}</div>`;
}

/**
 * Documento de HyperFrames para un flyer animado. Reutiliza el diseño del
 * flyer tal cual y le suma la coreografía, la placa final y la música.
 */
export function buildMotionHtml(template: FlyerTemplate, context: TemplateContext, font: string, options: MotionOptions): string {
  const { duration, bpm, outroStart, hook } = motionTiming(options.duration, options.bpm);
  const { css, body } = template.render(context);
  const { width, height } = context;
  const config = JSON.stringify({
    id: COMPOSITION_ID,
    template: template.id,
    duration,
    bpm,
    accent: context.theme.accent,
    hook,
    outro: { start: outroStart },
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=${width}, height=${height}">
<title>${escapeHtml(context.brandName)}</title><link rel="stylesheet" href="${escapeHtml(fontUrl(font))}">
<style>${baseCss(context, font)}${css}${MOTION_CSS}</style>
<script src="${MOTION_FILES.gsap}"></script></head><body>
<div id="root" data-composition-id="${COMPOSITION_ID}" data-width="${width}" data-height="${height}" data-duration="${duration}" style="width:${width}px;height:${height}px">
<section id="scene" class="clip" data-start="0" data-duration="${duration}" data-track-index="1"><div class="backdrop"></div>${body}</section>
<section id="end" class="clip" data-start="${outroStart}" data-duration="${(duration - outroStart).toFixed(3)}" data-track-index="2">${outroHtml(context, options.cta)}</section>
</div>
<script>${FIT_SCRIPT}</script><script>window.__MOTION=${config};</script><script src="${MOTION_FILES.choreography}"></script>
</body></html>`;
}
