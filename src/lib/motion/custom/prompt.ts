import type { FlyerTheme } from "../../flyers/theme";
import type { SlotValue } from "../../flyers/types";

/** Todo lo que Claude necesita saber para diseñar un video de esta marca. */
export interface DesignBrief {
  brandName: string;
  website: string;
  cta: string;
  width: number;
  height: number;
  duration: number;
  bpm: number;
  /** Segundo en que entra la placa final (coincide con el golpe del sonido). */
  outroStart: number;
  theme: FlyerTheme;
  headingFont: string;
  bodyFont: string;
  /** Archivos de logo disponibles en la carpeta del video. */
  logos: { onDark?: string; onLight?: string };
  /** Foto u objeto del flyer, si tiene. */
  asset?: { file: string; kind: "foto" | "objeto" };
  /** Diseño de flyer del que parte el contenido. */
  template: string;
  idea: string;
  slots: Record<string, SlotValue>;
}

/** Nombres fijos dentro de la composición. */
export const STAGE_ID = "stage";
export const TIMELINE_KEY = "flyer";

const CONTRACT = `CONTRATO TÉCNICO (si no se cumple, el video se descarta)
- Respondé SOLO con cuatro bloques, en este orden y sin nada más:
  <concept>una línea: la idea visual del video</concept>
  <css>...</css>
  <html>...</html>
  <script>...</script>
- Tu HTML va dentro de <div id="${STAGE_ID}">, que ya mide el ancho y alto pedidos, con position:relative y overflow:hidden. Dale fondo en el CSS (#${STAGE_ID}{background:...}). Posicioná con absolute dentro de #${STAGE_ID}. Prefijá tus selectores con #${STAGE_ID} para no pisar nada.
- GSAP 3 ya está cargado como variable global "gsap". Nada más.
- En el script: creá UNA línea de tiempo con gsap.timeline({ paused: true }) y registrala de inmediato: window.__timelines = window.__timelines || {}; window.__timelines["${TIMELINE_KEY}"] = tl;
  Si necesitás medir textos, agregá los tweens dentro de document.fonts.ready.then(...) pero registrá la línea ANTES, fuera del then.
- La línea de tiempo se recorre por saltos (seek), cuadro por cuadro. Todo debe depender solo del tiempo: usá tl.set / tl.to / tl.from / tl.fromTo con posición absoluta (tercer argumento, en segundos). onUpdate solo para contadores numéricos.
- PROHIBIDO: Math.random, Date, performance, setTimeout, setInterval, requestAnimationFrame, fetch, XMLHttpRequest, WebSocket, import, eval, new Function, repeat:-1, yoyo infinito, animaciones o transiciones CSS (@keyframes, animation, transition), <script>, <link>, <style>, <iframe>, <img> con URLs, cualquier dirección http(s), atributos on*=.
- Imágenes: solo los archivos que se te indican, por nombre relativo (src="logo-claro.png"). SVG en línea está permitido.
- Fuentes: solo las indicadas (ya cargadas). No uses otras.
- Tamaño total: menos de 40.000 caracteres.`;

const CRAFT = `CRITERIO (sos director de motion design para publicidad en redes)
- Una sola idea visual, concreta y propia de esta marca y este mensaje. Nombrala en <concept>. Nada que parezca plantilla.
- Cada escena nace de la anterior: formas, tipografía y color se transforman en lo siguiente. Sin cortes secos ni fundidos cruzados.
- 3 o 4 momentos: gancho en el primer compás (que se entienda sin sonido), desarrollo del mensaje, remate, y la placa de marca.
- Ritmo: todo lo importante arranca sobre un tiempo del tempo indicado. Curvas exponenciales o "power3/4" ("expo.out", "power4.inOut"). Nada de rebotes (back, elastic, bounce).
- Es publicidad: cada texto queda quieto y legible al menos 1,2 s. Tipografía grande, márgenes de al menos 6 % del ancho, contraste alto. Nada se superpone de forma ilegible.
- Paleta: los colores de la marca que te paso, más blanco y negro. Como mucho tres colores protagonistas.
- Prohibido: brillos, destellos de lente, partículas, sacudidas de cámara, separación RGB, degradados genéricos, emojis, signos de exclamación, personas, íconos de stock.
- Usá los textos tal cual: no inventes cifras, precios, plazos, promociones ni promesas. Podés partir o repartir el texto entre escenas, no cambiarlo.
- Formato vertical (más alto que ancho): componé en columna; cuadrado o 4:5: aprovechá el ancho.`;

function describeSlot(value: SlotValue): string {
  if (typeof value === "string") return value;
  if (value.every((item) => typeof item === "string")) return (value as string[]).map((item) => `\n    • ${item}`).join("");
  return (value as string[][]).map((row) => `\n    • ${row.join(" | ")}`).join("");
}

export function designSystemPrompt(): string {
  return `${CRAFT}\n\n${CONTRACT}`;
}

export function designUserPrompt(brief: DesignBrief): string {
  const beat = 60 / brief.bpm;
  const t = brief.theme;
  const logos = [
    brief.logos.onDark ? `- ${brief.logos.onDark}: logo para fondos oscuros.` : "",
    brief.logos.onLight ? `- ${brief.logos.onLight}: logo para fondos claros.` : "",
    brief.asset ? `- ${brief.asset.file}: ${brief.asset.kind === "objeto" ? "objeto recortado sobre fondo transparente" : "foto de la escena"}; usala como protagonista.` : "",
  ].filter(Boolean);
  const texts = Object.entries(brief.slots)
    .filter(([, value]) => (typeof value === "string" ? value.trim() : value.length))
    .map(([key, value]) => `- ${key}: ${describeSlot(value)}`);
  return `MARCA: ${brief.brandName}${brief.website ? ` (${brief.website})` : ""}
Lienzo: ${brief.width} × ${brief.height} px. Duración: ${brief.duration} s.
Tempo: ${brief.bpm} BPM (un tiempo = ${beat.toFixed(3)} s; un compás = ${(beat * 4).toFixed(3)} s).

Colores (hex):
- fondo ${t.bg}, texto ${t.fg}, secundario ${t.muted}
- acento ${t.accent} (texto sobre acento: ${t.onAccent})
- profundo ${t.deep}, tinta ${t.ink}, papel ${t.paper}
Fuentes: títulos "${brief.headingFont}", texto "${brief.bodyFont}".

Archivos disponibles:
${logos.length ? logos.join("\n") : "- (ninguno: la marca no tiene logo; usá el nombre como logotipo)"}

MENSAJE (viene de un flyer "${brief.template}"; por qué importa: ${brief.idea})
${texts.join("\n")}

PLACA FINAL (obligatoria): desde ${brief.outroStart} s hasta ${brief.duration} s, justo con el golpe más fuerte del sonido. Fondo ${t.accent} o ${t.deep}; logo (o el nombre si no hay logo), "${brief.brandName}", "${brief.cta}"${brief.website ? ` y "${brief.website}"` : ""}. Entra con una animación con carácter y queda quieta y legible el último segundo.

Diseñá el video.`;
}

/** Pedido de corrección: el código anterior y lo que hay que arreglar. */
export function repairPrompt(brief: DesignBrief, previous: string, problems: string[]): string {
  return `${designUserPrompt(brief)}

Este fue tu intento anterior:
${previous}

Hay que corregir:
${problems.map((problem) => `- ${problem}`).join("\n")}

Devolvé la versión corregida completa, con los cuatro bloques. Mantené la idea si funciona.`;
}

export function reviewSystemPrompt(): string {
  return `Revisás videos publicitarios antes de publicarlos. Te muestro una hoja con cuadros del video en orden (de izquierda a derecha y de arriba abajo), con el segundo de cada uno.
Marcá solo problemas que un cliente notaría: textos cortados, superpuestos o ilegibles; elementos fuera del cuadro; cuadros vacíos o rotos; placa final sin logo o sin el nombre de la marca; colores sin contraste.
Respondé solo con JSON: {"ok": true|false, "problems": ["problema concreto, con el segundo y qué cambiar"]}. Si está bien, ok true y lista vacía.`;
}
