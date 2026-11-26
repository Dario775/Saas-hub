import path from "node:path";
import { buildCustomHtml } from "./document";
import { designSystemPrompt, designUserPrompt, repairPrompt, reviewSystemPrompt, type DesignBrief } from "./prompt";
import { checkDesign, parseDesign, type Design } from "./validate";

/** Correcciones como máximo antes de darse por vencido (cada una es una consulta a Claude). */
const MAX_REPAIRS = 2;

export interface DesignerDeps {
  /** Pide el diseño a Claude (texto). */
  design(system: string, user: string): Promise<string>;
  /** Pide la revisión visual a Claude (JSON con la hoja de cuadros). */
  review(system: string, user: string, sheet: Buffer): Promise<string>;
  /** Escribe la composición en la carpeta. */
  write(directory: string, html: string): void;
  /** Errores al abrirla en Chrome; vacío si está sana. */
  validate(directory: string): Promise<string[]>;
  /** Hoja de cuadros del borrador. */
  sheet(directory: string, output: string): Promise<Buffer>;
  /** Avisa en qué paso está, para mostrarlo en el panel. */
  step(text: string): Promise<void>;
}

export interface DesignResult {
  html: string;
  concept: string;
  /** Problemas que la revisión vio y que se corrigieron. */
  reviewed: string[];
}

interface Context {
  brief: DesignBrief;
  directory: string;
  files: readonly string[];
  font: string;
  deps: DesignerDeps;
}

function toHtml(design: Design, context: Context): string {
  const { brief, font } = context;
  return buildCustomHtml({ design, width: brief.width, height: brief.height, duration: brief.duration, font, title: brief.brandName });
}

/** Lee la respuesta, la controla sin ejecutarla y después la abre en Chrome. */
async function accept(raw: string, context: Context): Promise<{ design: Design | null; html: string; problems: string[] }> {
  const { design, problems } = parseDesign(raw);
  if (!design) return { design: null, html: "", problems };
  const issues = checkDesign(design, context.files);
  if (issues.length) return { design, html: "", problems: issues };
  const html = toHtml(design, context);
  context.deps.write(context.directory, html);
  const errors = await context.deps.validate(context.directory);
  return { design, html, problems: errors.map((error) => `Error al ejecutar en Chrome: ${error}`) };
}

/** Pide el diseño y lo corrige hasta que pase los controles (o se acaben los intentos). */
async function designValid(context: Context, previous?: { raw: string; problems: string[] }): Promise<{ raw: string; design: Design; html: string }> {
  let raw = previous
    ? await context.deps.design(designSystemPrompt(), repairPrompt(context.brief, previous.raw, previous.problems))
    : await context.deps.design(designSystemPrompt(), designUserPrompt(context.brief));
  for (let attempt = 0; ; attempt++) {
    const result = await accept(raw, context);
    if (result.design && result.html && !result.problems.length) return { raw, design: result.design, html: result.html };
    if (attempt >= MAX_REPAIRS) throw new Error(`Claude no logró un diseño que funcione: ${result.problems.slice(0, 3).join(" ")}`);
    await context.deps.step("Corrigiendo el diseño");
    raw = await context.deps.design(designSystemPrompt(), repairPrompt(context.brief, raw, result.problems));
  }
}

function readReview(raw: string): string[] {
  try {
    const data = JSON.parse(raw) as { ok?: unknown; problems?: unknown };
    if (data.ok === true) return [];
    return Array.isArray(data.problems) ? data.problems.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
  } catch {
    // Una revisión ilegible no frena el video: se usa el diseño tal cual.
    return [];
  }
}

/**
 * Video "a medida": Claude diseña la composición completa, se controla,
 * se revisa con una hoja de cuadros y se corrige una vez si hace falta.
 */
export async function designCustomVideo(
  brief: DesignBrief,
  options: { directory: string; files: readonly string[]; font: string },
  deps: DesignerDeps,
): Promise<DesignResult> {
  const context: Context = { brief, ...options, deps };
  await deps.step("Claude está diseñando el video");
  const first = await designValid(context);
  await deps.step("Revisando el borrador");
  const sheet = await deps.sheet(options.directory, path.join(options.directory, "..", "cuadros"));
  const times = `Video de ${brief.duration} s; la placa de marca empieza en ${brief.outroStart} s. Concepto: ${first.design.concept}`;
  const problems = readReview(await deps.review(reviewSystemPrompt(), times, sheet));
  if (!problems.length) return { html: first.html, concept: first.design.concept, reviewed: [] };
  await deps.step("Ajustando lo que vio la revisión");
  try {
    const fixed = await designValid(context, { raw: first.raw, problems });
    return { html: fixed.html, concept: fixed.design.concept, reviewed: problems };
  } catch {
    // Si la corrección sale peor, queda el primer diseño, que ya funcionaba.
    deps.write(options.directory, first.html);
    return { html: first.html, concept: first.design.concept, reviewed: [] };
  }
}
