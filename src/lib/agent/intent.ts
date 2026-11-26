import type { FlyerFormat } from "../flyers/types";
import { MOTION_STYLES, readStyleChoice, STYLE_IDS, type MotionStyleChoice } from "../motion/styles";
import type { AgentAsk } from "./provider";

/** Límites de una campaña pedida por mensaje: evitan pedidos desmedidos por error. */
export const LIMITS = { pieces: 30, days: 14, perDay: 6 } as const;
const FORMATS: readonly FlyerFormat[] = ["4:5", "1:1", "9:16"];
const MAX_BRIEF = 1_500;

export interface BrandOption {
  id: string;
  name: string;
}

export interface CampaignRequest {
  brandId: string;
  /** Publicaciones con imagen. */
  images: number;
  /** Publicaciones con video (flyers animados, distintos de los de imagen). */
  videos: number;
  days: number;
  /** Primer día, AAAA-MM-DD. Si falta, mañana. */
  startDate: string | null;
  brief: string;
  format: FlyerFormat;
  /** Estilo de los videos (tempo y música). "auto" varía entre videos. */
  style: MotionStyleChoice;
}

export type Intent =
  | { kind: "campaign"; request: CampaignRequest }
  | { kind: "status" }
  | { kind: "help" }
  | { kind: "question"; text: string };

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function today(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function intentPrompt(brands: BrandOption[], now: Date): string {
  return `Sos el asistente de un panel de marketing. Recibís pedidos por Telegram (a veces transcriptos de un audio, con errores) y los convertís en una orden.

Hoy es ${WEEKDAYS[now.getDay()]} ${today(now)}.
Marcas disponibles (id: nombre):
${brands.map((brand) => `- ${brand.id}: ${brand.name}`).join("\n")}

Acciones:
- "campaign": crear piezas y programarlas en Facebook. "flyers" son publicaciones con imagen y "videos" publicaciones con video; son piezas distintas (10 flyers y 5 videos = 15 publicaciones).
- "status": quiere saber qué hay programado o cómo va algo.
- "help": saluda o pregunta qué podés hacer.
- "question": falta un dato indispensable o el pedido no se entiende. Escribí la pregunta en "question", en español rioplatense, corta.

Respondé solo con JSON:
{"action":"campaign|status|help|question","brandId":"id de la lista o null","flyers":0,"videos":0,"days":1,"startDate":"AAAA-MM-DD o null","format":"4:5|1:1|9:16 o null","style":"auto|medida|${STYLE_IDS.join("|")}","brief":"qué quiere comunicar, con sus palabras; vacío si no dijo nada","question":"solo si action es question"}

Conversación:
- Puede venir la charla previa. Juntá TODO lo que el usuario ya dijo en ella: la marca, las cantidades, el tema, los días. Un mensaje corto ("dos flyers y dos videos", "sí", "Obsidiana", "el lunes") casi siempre responde la última pregunta del agente y completa el pedido anterior.
- Nunca vuelvas a preguntar algo que el usuario ya contestó en la charla.
- "sí", "dale" o "listo" después de una pregunta tuya confirman lo que ya se habló: si con eso hay marca y cantidades, la acción es "campaign".
- Si el usuario dice que no, que cancele u olvide lo anterior, empezá de cero con su último mensaje.

Reglas:
- Solo preguntá ("question") si falta la marca o las cantidades. Todo lo demás tiene valor por defecto: no lo preguntes.
- La marca puede venir mal escrita o en minúsculas: elegí la de la lista que corresponda.
- Si no dice cuántos días, usá 1. Si dice "esta semana", contá los días que faltan hasta el domingo.
- "mañana", "el lunes", etc. van en startDate. Si no dice cuándo empezar, null (empieza mañana).
- style: el estilo de los videos si lo pide; si no, "auto" (cada video distinto). Estilos:
${STYLE_IDS.map((id) => `  - ${id}: ${MOTION_STYLES[id].label}, ${MOTION_STYLES[id].description.toLowerCase()} (${MOTION_STYLES[id].bpm} BPM)`).join("\n")}
  - medida: Claude diseña cada video desde cero (más original, tarda unos minutos y cuesta algo más). Solo si pide videos "a medida", "originales", "únicos", "creativos" o "distintos".
  "electrónico", "con energía", "movido" → energetico; "calmo", "lento", "lo-fi", "relajado" → tranquilo; "serio", "profesional", "institucional" → corporativo.
- brief: el objetivo o tema que contó en cualquier momento de la charla (por ejemplo "impulsar el registro en la plataforma"), con sus palabras.
- No inventes cantidades.`;
}

/** Mensaje para el modelo: la charla previa y el mensaje nuevo, bien separados. */
export function intentMessage(text: string, previous: string): string {
  const message = text.slice(0, 4_000);
  return previous ? `Charla previa:\n${previous}\n\nMensaje nuevo del usuario:\n${message}` : message;
}

function count(value: unknown): number {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function parse(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readDate(value: unknown, now: Date): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value >= today(now) ? value : null;
}

function findBrand(value: unknown, brands: BrandOption[]): BrandOption | undefined {
  const wanted = String(value || "").trim().toLowerCase();
  return brands.find((brand) => brand.id.toLowerCase() === wanted || brand.name.toLowerCase() === wanted);
}

/** Valida y acota lo que respondió el modelo. Nunca confía en sus números. */
export function normalizeIntent(raw: string, brands: BrandOption[], now = new Date()): Intent {
  const data = parse(raw);
  if (data.action === "status") return { kind: "status" };
  if (data.action === "help") return { kind: "help" };
  if (data.action !== "campaign") {
    const text = typeof data.question === "string" && data.question.trim() ? data.question.trim() : "";
    return { kind: "question", text: text || "No entendí el pedido. Probá con algo como: «10 flyers y 5 videos para Obsidiana en 3 días»." };
  }
  const brand = findBrand(data.brandId, brands);
  if (!brand) return { kind: "question", text: `¿Para qué marca? Tengo: ${brands.map((item) => item.name).join(", ")}.` };
  const images = count(data.flyers);
  const videos = count(data.videos);
  if (!images && !videos) return { kind: "question", text: "¿Cuántos flyers y cuántos videos querés?" };
  if (images + videos > LIMITS.pieces)
    return { kind: "question", text: `Puedo armar hasta ${LIMITS.pieces} piezas por pedido. ¿Lo dividimos?` };
  const days = Math.min(LIMITS.days, Math.max(1, count(data.days) || 1));
  if (Math.ceil((images + videos) / days) > LIMITS.perDay)
    return { kind: "question", text: `Serían más de ${LIMITS.perDay} publicaciones por día. ¿Lo repartimos en más días?` };
  const format = FORMATS.includes(data.format as FlyerFormat) ? (data.format as FlyerFormat) : "4:5";
  const brief = typeof data.brief === "string" ? data.brief.trim().slice(0, MAX_BRIEF) : "";
  return {
    kind: "campaign",
    request: { brandId: brand.id, images, videos, days, startDate: readDate(data.startDate, now), brief, format, style: readStyleChoice(data.style) },
  };
}

/** `previous`: la charla reciente del chat como texto (ver conversation.ts). */
export async function readIntent(text: string, brands: BrandOption[], ask: AgentAsk, now = new Date(), previous = ""): Promise<Intent> {
  const raw = await ask(intentPrompt(brands, now), intentMessage(text, previous));
  return normalizeIntent(raw, brands, now);
}
