import { CLAUDE_MODELS } from "../claude-models";
import { queryClaude } from "../claude";
import { designCustomVideo, type DesignerDeps, type DesignResult } from "../motion/custom/designer";
import type { MotionTiming } from "../motion/motion-html";
import { snapshotSheet, validateComposition, type Workspace } from "../motion/render-video";
import type { TemplateContext } from "./template";
import type { FlyerConcept } from "./types";

/** Diseñar un video es la tarea más creativa del panel: por defecto, el modelo más capaz. */
const DEFAULT_MODEL = "claude-opus-5-5";
const DESIGN_TIMEOUT_MS = 8 * 60_000;
const REVIEW_TIMEOUT_MS = 2 * 60_000;
export const LOGO_ON_DARK = "logo-blanco.png";
export const LOGO_ON_LIGHT = "logo-color.png";

export function customModel(env: NodeJS.ProcessEnv = process.env): string {
  return CLAUDE_MODELS.some((model) => model.id === env.MOTION_CUSTOM_MODEL) ? env.MOTION_CUSTOM_MODEL! : DEFAULT_MODEL;
}

function dataUrlBuffer(url: string | null): Buffer | null {
  const match = /^data:image\/[\w.+-]+;base64,(.+)$/.exec(url || "");
  return match ? Buffer.from(match[1], "base64") : null;
}

export interface CustomInput {
  concept: FlyerConcept;
  context: TemplateContext;
  font: string;
  cta: string;
  timing: MotionTiming;
  asset: { name: string; data: Buffer } | null;
  directory: string;
  prepare(directory: string, workspace: Workspace): void;
  step(text: string): Promise<void>;
}

/** Archivos que Claude puede usar: los logos de la marca y la foto u objeto del flyer. */
function workspaceFiles(input: CustomInput): Array<{ name: string; data: Buffer }> {
  const files = [
    { name: LOGO_ON_DARK, data: dataUrlBuffer(input.context.logoLightUrl) },
    { name: LOGO_ON_LIGHT, data: dataUrlBuffer(input.context.logoDarkUrl) },
  ];
  return files.filter((file): file is { name: string; data: Buffer } => Boolean(file.data));
}

/** Diseña con Claude la composición de un flyer. La deja escrita en `directory`. */
export async function designFlyerVideo(input: CustomInput, overrides: Partial<DesignerDeps> = {}): Promise<DesignResult> {
  const files = workspaceFiles(input);
  const names = files.map((file) => file.name);
  const model = customModel();
  const deps: DesignerDeps = {
    design: (system, user) => queryClaude({ model, system, user, effort: "high", timeoutMs: DESIGN_TIMEOUT_MS }),
    review: (system, user, sheet) =>
      queryClaude({ model, system, user, image: sheet, expectJson: true, effort: "low", timeoutMs: REVIEW_TIMEOUT_MS }),
    write: (directory, html) => input.prepare(directory, { html, asset: input.asset ?? undefined, files }),
    validate: validateComposition,
    sheet: (directory, output) => snapshotSheet(directory, output),
    step: input.step,
    ...overrides,
  };
  const { context, timing } = input;
  return designCustomVideo(
    {
      brandName: context.brandName,
      website: context.website,
      cta: input.cta,
      width: context.width,
      height: context.height,
      duration: timing.duration,
      bpm: timing.bpm,
      outroStart: timing.outroStart,
      theme: context.theme,
      headingFont: input.font,
      bodyFont: "Inter Tight",
      logos: { onDark: names.includes(LOGO_ON_DARK) ? LOGO_ON_DARK : undefined, onLight: names.includes(LOGO_ON_LIGHT) ? LOGO_ON_LIGHT : undefined },
      asset: input.asset ? { file: input.asset.name, kind: input.concept.template === "objeto" ? "objeto" : "foto" } : undefined,
      template: input.concept.template,
      idea: input.concept.idea,
      slots: input.concept.slots,
    },
    { directory: input.directory, files: [...names, ...(input.asset ? [input.asset.name] : [])], font: input.font },
    deps,
  );
}
