/**
 * Memoria corta de cada chat: lo último que se dijeron el usuario y el agente.
 * Sin esto, cada mensaje llega suelto y una respuesta como "dos flyers" o "sí"
 * no se entiende. Vive en memoria: un reinicio del panel empieza de cero.
 */
export const CONVERSATION_TTL_MS = 30 * 60_000;
const MAX_TURNS = 12;
const MAX_TEXT = 1_000;

export interface Turn {
  role: "user" | "agent";
  text: string;
  at: number;
}

const memory = globalThis as typeof globalThis & { saasAgentTalk?: Map<number, Turn[]> };

function store(): Map<number, Turn[]> {
  memory.saasAgentTalk ??= new Map();
  return memory.saasAgentTalk;
}

/** Turnos vigentes: si pasó media hora desde el último, la charla anterior ya no cuenta. */
export function history(chatId: number, now = Date.now()): Turn[] {
  const turns = store().get(chatId) ?? [];
  const last = turns.at(-1);
  if (!last || now - last.at > CONVERSATION_TTL_MS) return [];
  return turns;
}

export function remember(chatId: number, role: Turn["role"], text: string, now = Date.now()): void {
  const turn: Turn = { role, text: text.slice(0, MAX_TEXT), at: now };
  store().set(chatId, [...history(chatId, now), turn].slice(-MAX_TURNS));
}

export function forget(chatId: number): void {
  store().delete(chatId);
}

/** La charla previa como texto para el modelo. */
export function transcript(turns: Turn[]): string {
  return turns.map((turn) => `${turn.role === "user" ? "Usuario" : "Agente"}: ${turn.text}`).join("\n");
}
