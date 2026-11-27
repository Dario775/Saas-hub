import { queryClaude } from "../claude";
import { queryLLM } from "../llm";
import { FLYER_TEMPLATES, findTemplate } from "./templates";
import type { FlyerTemplate } from "./template";
import { FLYER_TONES, type FlyerBrand, type FlyerConcept, type FlyerReview } from "./types";
import { parseJsonObject, validateConcept } from "./validate";

export const CONCEPT_COUNT = 4;
const DIRECTOR_TIMEOUT_MS = 180_000;
const REVIEW_TIMEOUT_MS = 120_000;
const APPROVAL_SCORE = 8;

/** Pregunta al modelo elegido. Inyectable para tests. */
export type Ask = (system: string, user: string, image?: Buffer) => Promise<string>;

/** Con un modelo de Claude usa su API (y puede ver imágenes); si no, la IA activa del panel. */
export function createAsk(model: string): { ask: Ask; canSee: boolean } {
  if (model.startsWith("claude-"))
    return {
      canSee: true,
      ask: (system, user, image) =>
        queryClaude({ model, system, user, image, expectJson: true, timeoutMs: image ? REVIEW_TIMEOUT_MS : DIRECTOR_TIMEOUT_MS }),
    };
  // "ollama:modelo" fuerza el modelo local, sin importar la IA activa del panel.
  const local = /^ollama:(.+)$/.exec(model);
  const settings = local ? { provider: "ollama" as const, ollamaModel: local[1] } : undefined;
  return {
    canSee: false,
    ask: (system, user) => queryLLM(system, user, settings, true, { timeoutMs: DIRECTOR_TIMEOUT_MS }),
  };
}

function describeSlots(template: FlyerTemplate): string {
  return template.slots
    .map((slot) => {
      const count = slot.items ? ` (${slot.items[0] === slot.items[1] ? slot.items[0] : slot.items.join(" a ")} elementos)` : "";
      const shape = slot.kind === "text" ? "texto" : slot.kind === "list" ? `lista${count}` : `tabla${count} de ${slot.columns} columnas`;
      return `    - ${slot.key}: ${shape}, máx. ${slot.max} caracteres${slot.kind === "text" ? "" : " cada uno"}${slot.optional ? ", opcional" : ""}. ${slot.label}.`;
    })
    .join("\n");
}

function describeTemplate(template: FlyerTemplate): string {
  const asset = template.asset ? `\n  assetPrompt: obligatorio, en inglés. Solo QUÉ se ve (${template.asset === "objeto" ? "un único objeto físico" : "una escena"}); el estilo lo agrega el sistema.` : "";
  return `- ${template.id}: ${template.purpose}\n  tone: ${template.tones.join(" | ")}${asset}\n  slots:\n${describeSlots(template)}`;
}

const CRAFT_RULES = `CÓMO PENSÁS
- Cada flyer tiene UNA idea que un dueño de negocio entiende en dos segundos. Si la idea sirve para cualquier empresa del rubro, descartala.
- Partí de una escena concreta y reconocible del cliente (un objeto, una frase que dice, un error que comete), no de un beneficio abstracto.
- Escribí como habla la gente: español rioplatense con voseo, frases cortas, verbos. Humor seco si suma.
- El titular no explica: provoca. El cuerpo explica en una oración.

EJEMPLOS DEL NIVEL ESPERADO (son de otros rubros: no los copies ni los adaptes)
- Dentista, conversación: "Te juro que mañana pido turno", cuatro lunes seguidos. Titular: "La muela no lee los mensajes."
- Gimnasio, afirmación: "El lunes arranco," / "dijiste en marzo."
- Ferretería, objeto (un tornillo enorme): "Ese" / "justo."

PROHIBIDO
- Frases gastadas: "llevá tu negocio al siguiente nivel", "transformación digital", "soluciones integrales", "potenciá", "innovación", "el futuro es hoy".
- Inventar cifras, porcentajes, precios, plazos, clientes, testimonios, premios, garantías o promociones que no estén en el pedido.
- Prometer algo que la marca no dice hacer.
- Personas posando, ejecutivos, apretones de manos, robots, cerebros, hologramas, salas de servidores.
- Emojis y signos de exclamación dentro del flyer.`;

/** Diseños que se pueden usar: todos, o solo los que pidió el usuario. */
function allowedTemplates(only?: readonly string[]): FlyerTemplate[] {
  const chosen = only?.length ? FLYER_TEMPLATES.filter((template) => only.includes(template.id)) : [];
  return chosen.length ? chosen : [...FLYER_TEMPLATES];
}

/** Cuántas veces puede repetirse un diseño: si pidieron menos de los que entran en una tanda. */
function maxPerTemplate(allowed: readonly FlyerTemplate[]): number {
  return Math.ceil(CONCEPT_COUNT / allowed.length);
}

export function buildDirectorPrompt(brand: FlyerBrand, only?: readonly string[]): string {
  const allowed = allowedTemplates(only);
  const repeat = maxPerTemplate(allowed) > 1;
  const restricted = allowed.length < FLYER_TEMPLATES.length;
  return `Sos director creativo de una agencia premiada en Buenos Aires. Pensás conceptos de flyers y elegís el sistema de diseño que mejor cuenta cada idea. No diseñás: completás los textos de un sistema ya diseñado.

MARCA
- Nombre: ${brand.name}
- Qué hace: ${brand.description || "sin datos"}
- Para quién: ${brand.audience || "sin datos"}
- Propuesta: ${brand.valueProposition || "sin datos"}
- Voz: ${brand.voice || "clara y profesional"}

${CRAFT_RULES}

SISTEMAS DE DISEÑO DISPONIBLES${restricted ? " (el cliente pidió solo estos)" : ""}
${allowed.map(describeTemplate).join("\n")}

SALIDA
Respondé solo con JSON: {"concepts":[{"template":"id","tone":"claro|oscuro|acento","idea":"por qué esto le importa al cliente, en una oración","slots":{...},"assetPrompt":"solo si el sistema lo pide","caption":"texto para la publicación, 3 a 5 líneas, con un llamado a escribir y 2 a 4 hashtags"}]}
- ${CONCEPT_COUNT} conceptos, ${repeat ? `todos con ideas distintas; podés repetir sistema (hasta ${maxPerTemplate(allowed)} veces cada uno)` : "cada uno con un sistema distinto y una idea distinta"}.
- Como máximo 2 con recurso visual (foto u objeto).
- Respetá los largos máximos: se miden.`;
}

/** Lo que la marca ya hizo, para no repetirse. */
export interface FlyerHistory {
  headlines: readonly string[];
  templates: readonly string[];
}

const NO_HISTORY: FlyerHistory = { headlines: [], templates: [] };

function briefPrompt(brief: string, history: FlyerHistory, restricted = false): string {
  const headlines = history.headlines.length
    ? `\n\nYA USADOS POR ESTA MARCA (no los repitas ni los parafrasees)\n${history.headlines.map((item) => `- ${item}`).join("\n")}`
    : "";
  const templates = history.templates.length && !restricted
    ? `\n\nEl pedido anterior usó estos sistemas: ${history.templates.join(", ")}. Usá a lo sumo uno de ellos.`
    : "";
  const avoid = headlines + templates;
  return `PEDIDO\n${brief}${avoid}\n\nPensá al menos diez ideas, descartá las previsibles y devolvé las ${CONCEPT_COUNT} mejores.`;
}

function readConcepts(raw: string, allowed: readonly FlyerTemplate[] = FLYER_TEMPLATES): { concepts: FlyerConcept[]; errors: string[] } {
  const list = parseJsonObject(raw).concepts;
  const errors: string[] = [];
  const concepts: FlyerConcept[] = [];
  const used = new Map<string, number>();
  const limit = maxPerTemplate(allowed);
  for (const item of Array.isArray(list) ? list : []) {
    const result = validateConcept(item);
    if (!result.ok) errors.push(...result.errors);
    else if (!allowed.some((template) => template.id === result.value.template)) errors.push(`${result.value.template}: no está entre los sistemas pedidos.`);
    else if ((used.get(result.value.template) ?? 0) >= limit) errors.push(`${result.value.template}: sistema repetido.`);
    else {
      used.set(result.value.template, (used.get(result.value.template) ?? 0) + 1);
      concepts.push(result.value);
    }
  }
  return { concepts: concepts.slice(0, CONCEPT_COUNT), errors };
}

/** Pide los conceptos y, si alguno no cumple, una corrección con los errores exactos. */
export async function createConcepts(
  brand: FlyerBrand,
  brief: string,
  ask: Ask,
  history: FlyerHistory = NO_HISTORY,
  only?: readonly string[],
): Promise<FlyerConcept[]> {
  const allowed = allowedTemplates(only);
  const restricted = allowed.length < FLYER_TEMPLATES.length;
  const repeat = maxPerTemplate(allowed) > 1;
  const system = buildDirectorPrompt(brand, only);
  const first = readConcepts(await ask(system, briefPrompt(brief, history, restricted)), allowed);
  if (first.concepts.length >= CONCEPT_COUNT) return first.concepts;

  const used = first.concepts.map((concept) => concept.template);
  const missing = CONCEPT_COUNT - first.concepts.length;
  const avoid = used.length && !repeat ? `, sin usar estos sistemas: ${used.join(", ")}` : "";
  const second = readConcepts(
    await ask(
      system,
      `${briefPrompt(brief, history, restricted)}\n\nEn tu intento anterior hubo problemas:\n${first.errors.slice(0, 12).map((error) => `- ${error}`).join("\n")}\n\nDevolvé ${missing} conceptos nuevos que los respeten${avoid}.`,
    ),
    allowed,
  );
  const extra = repeat ? second.concepts : second.concepts.filter((concept) => !used.includes(concept.template));
  const concepts = [...first.concepts, ...extra].slice(0, CONCEPT_COUNT);
  if (!concepts.length) throw new Error("La IA no logró proponer conceptos válidos. Probá con otro modelo o un pedido más concreto.");
  return concepts;
}

const REVIEW_SYSTEM = `Sos director de arte y corrector. Revisás un flyer terminado, con ojo exigente, antes de publicarlo.
Mirá: texto cortado, encimado o ilegible; poco contraste; palabras huérfanas; jerarquía confusa; faltas de ortografía; recurso visual malo, deforme o con letras inventadas; titular débil o genérico; promesas o datos que no estén en el pedido.
Puntuá de 0 a 10: 8 es publicable en una marca exigente.
Corregí solo lo necesario. Los textos nuevos respetan el largo de cada campo y mantienen la idea.
Respondé solo con JSON: {"score":0,"problems":["..."],"slots":{solo los campos a cambiar, completos},"tone":"solo si conviene cambiarlo","assetPrompt":"solo si hay que rehacer el recurso visual"}`;

function conceptPrompt(concept: FlyerConcept, brief: string): string {
  const template = findTemplate(concept.template)!;
  return `PEDIDO ORIGINAL\n${brief}\n\nSISTEMA\n${describeTemplate(template)}\n\nCONTENIDO ACTUAL\n${JSON.stringify({ tone: concept.tone, slots: concept.slots, assetPrompt: concept.assetPrompt })}`;
}

/** El titular de un concepto, para no repetirlo en pedidos futuros. */
export function headlineOf(concept: FlyerConcept): string {
  const { titular, linea, destacado, palabra1, palabra2 } = concept.slots;
  return [titular || linea || palabra1, destacado || palabra2]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" ");
}

export interface ReviewResult {
  review: FlyerReview;
  /** Concepto corregido, si la revisión propuso cambios válidos. */
  next: FlyerConcept | null;
  redoAsset: boolean;
}

/** Aplica cambios parciales y vuelve a validar todo el concepto. */
export function applyChanges(concept: FlyerConcept, changes: Record<string, unknown>): FlyerConcept | null {
  const slots = changes.slots && typeof changes.slots === "object" ? (changes.slots as Record<string, unknown>) : {};
  const merged = validateConcept({
    ...concept,
    tone: FLYER_TONES.find((tone) => tone === changes.tone) || concept.tone,
    slots: { ...concept.slots, ...slots },
    assetPrompt: typeof changes.assetPrompt === "string" && changes.assetPrompt.trim() ? changes.assetPrompt : concept.assetPrompt,
    caption: typeof changes.caption === "string" && changes.caption.trim() ? changes.caption : concept.caption,
  });
  if (!merged.ok) return null;
  return JSON.stringify(merged.value) === JSON.stringify(concept) ? null : merged.value;
}

export async function reviewFlyer(concept: FlyerConcept, brief: string, image: Buffer, ask: Ask): Promise<ReviewResult> {
  const answer = parseJsonObject(await ask(REVIEW_SYSTEM, conceptPrompt(concept, brief), image));
  const score = Math.max(0, Math.min(10, Number(answer.score) || 0));
  const problems = Array.isArray(answer.problems) ? answer.problems.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
  const approved = score >= APPROVAL_SCORE;
  const next = approved ? null : applyChanges(concept, answer);
  return { review: { score, approved, problems }, next, redoAsset: Boolean(next && next.assetPrompt !== concept.assetPrompt) };
}

const REVISE_SYSTEM = `Sos director de arte. Ajustás un flyer según lo que pide el cliente, sin perder la idea ni romper el diseño. Los textos respetan el largo de cada campo. No inventes datos, precios ni promesas.
Respondé solo con JSON: {"slots":{solo los campos a cambiar, completos},"tone":"solo si cambia","assetPrompt":"solo si el cliente pide otra imagen, en inglés","caption":"solo si cambia"}`;

export async function reviseConcept(concept: FlyerConcept, brief: string, instruction: string, image: Buffer | undefined, ask: Ask): Promise<FlyerConcept> {
  const answer = parseJsonObject(await ask(REVISE_SYSTEM, `${conceptPrompt(concept, brief)}\n\nEL CLIENTE PIDE\n${instruction}`, image));
  const next = applyChanges(concept, answer);
  if (!next) throw new Error("Ese ajuste no se puede hacer en este diseño. Probá pedirlo de otra forma.");
  return next;
}
