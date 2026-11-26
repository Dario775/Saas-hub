/** Modelos de Claude que ofrece el panel. Sin dependencias: lo usan servidor y navegador. */
export interface ClaudeModel {
  id: string;
  label: string;
  /** Precio público por millón de tokens, en USD (entrada / salida). */
  price: string;
  /** Acepta que la API reintente un rechazo en otro modelo. */
  serverFallback: boolean;
}

export const CLAUDE_MODELS: readonly ClaudeModel[] = [
  { id: "claude-opus-5-5", label: "Opus 5.5 (recomendado)", price: "US$ 4 / 20", serverFallback: true },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5 (equilibrado)", price: "US$ 2 / 10", serverFallback: true },
  { id: "claude-haiku-5-5", label: "Haiku 5.5 (económico)", price: "US$ 0,10 / 0,50", serverFallback: false },
  { id: "claude-fable-5-2", label: "Fable 5.2 (máxima capacidad)", price: "US$ 8 / 40", serverFallback: true },
];

export const CLAUDE_DEFAULT_MODEL = CLAUDE_MODELS[0].id;

export function findClaudeModel(id: string): ClaudeModel | undefined {
  return CLAUDE_MODELS.find((model) => model.id === id);
}
