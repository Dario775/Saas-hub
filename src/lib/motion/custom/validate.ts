import { TIMELINE_KEY } from "./prompt";

/** Lo que devuelve Claude, ya separado en bloques. */
export interface Design {
  concept: string;
  css: string;
  html: string;
  script: string;
}

const MAX_TOTAL = 40_000;
const MAX_CONCEPT = 300;

function block(raw: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(raw);
  return match ? match[1].trim() : null;
}

/** Separa los cuatro bloques. Devuelve los faltantes como problemas. */
export function parseDesign(raw: string): { design: Design | null; problems: string[] } {
  const parts = { concept: block(raw, "concept"), css: block(raw, "css"), html: block(raw, "html"), script: block(raw, "script") };
  const missing = Object.entries(parts)
    .filter(([key, value]) => value === null || (key !== "css" && !value))
    .map(([key]) => `Falta el bloque <${key}> o está vacío.`);
  if (missing.length) return { design: null, problems: missing };
  return {
    design: {
      concept: parts.concept!.replace(/\s+/g, " ").slice(0, MAX_CONCEPT),
      css: parts.css ?? "",
      html: parts.html!,
      script: parts.script!,
    },
    problems: [],
  };
}

interface Rule {
  pattern: RegExp;
  problem: string;
}

/** Cosas que no pueden aparecer en ningún bloque. */
const EVERYWHERE: Rule[] = [
  { pattern: /https?:\/\/|\/\/[a-z0-9.-]+\.[a-z]{2,}\//i, problem: "Usa direcciones de internet; solo se permiten los archivos indicados." },
  { pattern: /javascript:/i, problem: "Usa URLs javascript:." },
  { pattern: /<\/?(script|link|style|iframe|object|embed|base|meta|form|video|audio)\b/i, problem: "Incluye etiquetas no permitidas (script, link, style, iframe, video, audio, etc.)." },
];

const IN_SCRIPT: Rule[] = [
  { pattern: /\bMath\.random\b/, problem: "Usa Math.random: el video tiene que salir igual en cada cuadro." },
  { pattern: /\b(Date|performance)\b/, problem: "Usa la hora del sistema (Date o performance)." },
  { pattern: /\b(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback|queueMicrotask)\b/, problem: "Usa temporizadores; todo debe depender del tiempo de la línea." },
  { pattern: /\b(fetch|XMLHttpRequest|WebSocket|EventSource|navigator|sendBeacon|Worker|SharedWorker|importScripts)\b/, problem: "Intenta usar la red o procesos aparte." },
  { pattern: /\b(eval|Function)\s*\(|\bimport\s*\(|\bimport\s+[\w{*]/, problem: "Usa eval, Function o import." },
  { pattern: /\b(localStorage|sessionStorage|indexedDB|document\.cookie|window\.open|location\s*=|window\.location|top\.|parent\.)/, problem: "Accede a almacenamiento, cookies o navegación." },
  { pattern: /\brepeat\s*:\s*-\s*1\b/, problem: "Usa repeticiones infinitas (repeat: -1)." },
  { pattern: /\.innerHTML\s*=|insertAdjacentHTML|document\.write/, problem: "Inserta HTML desde el script; el HTML va en su bloque." },
];

const IN_CSS: Rule[] = [
  { pattern: /@keyframes|\banimation\s*:|\banimation-name\s*:|\btransition\s*:/i, problem: "Usa animaciones o transiciones CSS; todo debe ir en la línea de GSAP." },
  { pattern: /@import/i, problem: "Usa @import." },
];

const IN_HTML: Rule[] = [{ pattern: /\son[a-z]+\s*=/i, problem: "Usa atributos de evento (on...=)." }];

function check(text: string, rules: Rule[]): string[] {
  return rules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.problem);
}

/** Archivos que el diseño nombra (src="...", url(...)). */
function referencedFiles(design: Design): string[] {
  const files = new Set<string>();
  for (const match of design.html.matchAll(/\b(?:src|href|xlink:href)\s*=\s*["']([^"']+)["']/gi)) files.add(match[1]);
  for (const match of design.css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) files.add(match[1]);
  return [...files].filter((file) => !file.startsWith("#") && !file.startsWith("data:image/svg+xml"));
}

/**
 * Revisión estática del código que escribió Claude, antes de abrirlo en
 * Chrome. No reemplaza la política de seguridad del documento: la suma.
 */
export function checkDesign(design: Design, allowedFiles: readonly string[]): string[] {
  const all = `${design.css}\n${design.html}\n${design.script}`;
  const problems = [...check(all, EVERYWHERE), ...check(design.script, IN_SCRIPT), ...check(design.css, IN_CSS), ...check(design.html, IN_HTML)];
  if (all.length > MAX_TOTAL) problems.push(`El código supera los ${MAX_TOTAL} caracteres.`);
  if (!/gsap\.timeline\s*\(\s*\{[^}]*paused\s*:\s*true/.test(design.script)) problems.push("La línea de tiempo no se crea con gsap.timeline({ paused: true }).");
  if (!new RegExp(`__timelines\\s*\\[\\s*["']${TIMELINE_KEY}["']\\s*\\]\\s*=`).test(design.script))
    problems.push(`No registra la línea en window.__timelines["${TIMELINE_KEY}"].`);
  const unknown = referencedFiles(design).filter((file) => !allowedFiles.includes(file));
  if (unknown.length) problems.push(`Usa archivos que no existen: ${unknown.join(", ")}.`);
  return [...new Set(problems)];
}
