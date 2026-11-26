import { findTemplate } from "./templates";
import type { FlyerTemplate } from "./template";
import { FLYER_TONES, type FlyerConcept, type FlyerSlots, type FlyerTone, type SlotSpec, type SlotValue } from "./types";

/** Margen sobre el largo pedido: el diseño achica el texto, pero no tanto. */
const LENGTH_TOLERANCE = 1.25;
const MAX_ASSET_PROMPT = 900;
const MAX_CAPTION = 2_200;

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function checkText(value: string, spec: SlotSpec, where: string, errors: string[]): void {
  if (value.length > Math.ceil(spec.max * LENGTH_TOLERANCE))
    errors.push(`${where}: ${value.length} caracteres, máximo ${spec.max}.`);
}

function checkCount(count: number, spec: SlotSpec, errors: string[]): boolean {
  const [min, max] = spec.items || [1, 6];
  if (count >= min && count <= max) return true;
  errors.push(`${spec.key}: ${count} elementos, deben ser ${min === max ? min : `${min} a ${max}`}.`);
  return false;
}

function readSlot(raw: unknown, spec: SlotSpec, errors: string[]): SlotValue | undefined {
  if (spec.kind === "text") {
    const value = cleanText(raw);
    if (!value && !spec.optional) errors.push(`${spec.key}: falta.`);
    checkText(value, spec, spec.key, errors);
    return value;
  }
  if (!Array.isArray(raw)) {
    errors.push(`${spec.key}: debe ser una lista.`);
    return undefined;
  }
  if (!checkCount(raw.length, spec, errors)) return undefined;
  if (spec.kind === "list") {
    const items = raw.map(cleanText);
    items.forEach((item, index) => checkText(item, spec, `${spec.key}[${index}]`, errors));
    return items;
  }
  return raw.map((row, index) => {
    const cells = Array.isArray(row) ? row.map(cleanText) : [];
    if (cells.length !== spec.columns) errors.push(`${spec.key}[${index}]: debe tener ${spec.columns} columnas.`);
    cells.forEach((cell, column) => checkText(cell, spec, `${spec.key}[${index}][${column}]`, errors));
    return cells;
  });
}

/** Revisa los textos de un diseño. Descarta claves que el diseño no usa. */
export function validateSlots(template: FlyerTemplate, raw: unknown): Validation<FlyerSlots> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const errors: string[] = [];
  const slots: FlyerSlots = {};
  for (const spec of template.slots) {
    const value = readSlot(source[spec.key], spec, errors);
    if (value !== undefined) slots[spec.key] = value;
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: slots };
}

/** Nada de lo que devuelve la IA llega al diseño sin pasar por acá. */
export function validateConcept(raw: unknown): Validation<FlyerConcept> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const template = findTemplate(cleanText(source.template));
  if (!template) return { ok: false, errors: [`template: "${cleanText(source.template)}" no existe.`] };

  const slots = validateSlots(template, source.slots);
  const errors = slots.ok ? [] : slots.errors.map((error) => `${template.id}: ${error}`);
  const assetPrompt = cleanText(source.assetPrompt).slice(0, MAX_ASSET_PROMPT);
  if (template.asset && !assetPrompt) errors.push(`${template.id}: falta assetPrompt.`);
  if (!slots.ok || errors.length) return { ok: false, errors };

  const requested = FLYER_TONES.find((tone) => tone === source.tone);
  const tone: FlyerTone = requested && template.tones.includes(requested) ? requested : template.tones[0];
  return {
    ok: true,
    value: {
      template: template.id,
      tone,
      idea: cleanText(source.idea),
      slots: slots.value,
      ...(template.asset ? { assetPrompt } : {}),
      caption: typeof source.caption === "string" ? source.caption.trim().slice(0, MAX_CAPTION) : "",
    },
  };
}

/** Extrae el objeto JSON de una respuesta, aunque venga con texto alrededor. */
export function parseJsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La IA no devolvió un JSON.");
  const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("La IA no devolvió un objeto JSON.");
  return parsed as Record<string, unknown>;
}
