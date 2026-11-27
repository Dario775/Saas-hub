import {
  cancelCampaign,
  isCampaignRunning,
  scheduleCampaign,
  startCampaign,
  type CampaignDeps,
} from "../agent/campaign";
import { forget, history, remember, transcript } from "../agent/conversation";
import { readIntent, TEMPLATE_NAMES, type BrandOption, type CampaignRequest } from "../agent/intent";
import type { AgentAsk } from "../agent/provider";
import { formatSlot, planSlots } from "../agent/slots";
import { readCampaigns } from "../agent/store";
import { MAX_AUDIO_SECONDS } from "../agent/transcribe";
import { upcomingSummary } from "../agent/watch";
import { CUSTOM_STYLE, styleLabel } from "../motion/styles";
import type { ScheduledPost } from "../schedule-types";
import type { TelegramApi, TelegramCallback, TelegramMessage } from "./api";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export interface BotContext {
  api: TelegramApi;
  /** Usuarios de Telegram que pueden dar órdenes. Vacío: el bot solo dice cómo configurarlo. */
  allowed: Set<number>;
  ask: AgentAsk;
  modelLabel: string;
  brands(): BrandOption[];
  posts(): ScheduledPost[];
  pageNames(): Map<string, string>;
  transcribe(audio: Buffer): Promise<string>;
  campaignDeps(): CampaignDeps;
}

function helpText(context: BrandOption[], modelLabel: string): string {
  return [
    "Mandame un audio o un mensaje con lo que necesitás. Por ejemplo:",
    "«Creá 10 flyers y 5 videos para Obsidiana, repartidos en 3 días desde el lunes».",
    "",
    "Armo todo, te muestro cómo quedó y lo programo en Facebook cuando apruebes. Después te aviso cuando sale cada publicación.",
    "También podés preguntarme «¿qué hay programado?».",
    "",
    `Marcas: ${context.map((brand) => brand.name).join(", ")}.`,
    `Pienso con ${modelLabel}.`,
  ].join("\n");
}

function describeRequest(request: CampaignRequest, brandName: string): string {
  const parts = [request.images ? `${request.images} flyer${request.images === 1 ? "" : "s"}` : "", request.videos ? `${request.videos} video${request.videos === 1 ? "" : "s"}` : ""]
    .filter(Boolean)
    .join(" y ");
  const first = planSlots(request)[0];
  const start = first ? `, desde ${formatSlot(first.at).replace(/ \d\d:\d\d$/, "")}` : "";
  const style = request.videos && request.style !== "auto" ? `, videos ${request.style === CUSTOM_STYLE ? "diseñados a medida por Claude" : `en estilo ${styleLabel(request.style).toLowerCase()}`}` : "";
  const designs = request.templates?.length ? `, flyers ${request.templates.map((id) => `tipo «${TEMPLATE_NAMES[id] ?? id}»`).join(" y ")}` : "";
  const hours = request.times?.length ? `, a las ${request.times.join(" y ")}` : "";
  return `Voy a crear ${parts} para ${brandName} (formato ${request.format}${style}${designs}${hours}), repartidos en ${request.days} día${request.days === 1 ? "" : "s"}${start}. Tarda unos minutos: te aviso cuando estén para que los revises.`;
}

/** Responde y lo anota en la charla, para que el próximo mensaje tenga contexto. */
async function reply(context: BotContext, chatId: number, text: string, note = text): Promise<void> {
  remember(chatId, "agent", note);
  await context.api.sendMessage(chatId, text);
}

async function handleText(context: BotContext, chatId: number, text: string): Promise<void> {
  await context.api.sendChatAction(chatId, "typing").catch(() => undefined);
  const brands = context.brands();
  const intent = await readIntent(text, brands, context.ask, new Date(), transcript(history(chatId)));
  remember(chatId, "user", text);
  if (intent.kind === "help") return reply(context, chatId, helpText(brands, context.modelLabel), "(Explicó qué puede hacer y pidió el pedido.)");
  if (intent.kind === "question") return reply(context, chatId, intent.text);
  if (intent.kind === "status") {
    const running = readCampaigns().find((campaign) => campaign.status === "generating" || campaign.status === "scheduling");
    const current = running ? `En curso: ${running.step}.\n\n` : "";
    return reply(context, chatId, current + upcomingSummary(context.posts(), context.pageNames()), "(Mostró lo programado.)");
  }
  if (isCampaignRunning()) return reply(context, chatId, "Ya estoy con otro pedido. Te aviso cuando termine y me mandás este.");
  const brandName = brands.find((brand) => brand.id === intent.request.brandId)?.name || intent.request.brandId;
  await context.api.sendMessage(chatId, describeRequest(intent.request, brandName));
  // El pedido ya arrancó: lo próximo que diga es un pedido nuevo.
  forget(chatId);
  await startCampaign(chatId, intent.request, context.campaignDeps());
}

async function readAudio(context: BotContext, message: TelegramMessage): Promise<string | null> {
  const audio = message.voice || message.audio;
  if (!audio) return null;
  if (audio.duration > MAX_AUDIO_SECONDS) throw new Error("El audio es muy largo. Mandame uno de menos de 5 minutos.");
  await context.api.sendChatAction(message.chat.id, "typing").catch(() => undefined);
  const text = await context.transcribe(await context.api.download(audio.file_id, MAX_AUDIO_BYTES));
  await context.api.sendMessage(message.chat.id, `Entendí: «${text}»`);
  return text;
}

export async function handleMessage(context: BotContext, message: TelegramMessage): Promise<void> {
  const userId = message.from?.id;
  const chatId = message.chat.id;
  if (!userId) return;
  if (!context.allowed.size) {
    // Todavía sin configurar: solo dice qué id autorizar. No hace nada más.
    await context.api.sendMessage(chatId, `Para usarme, agregá esta línea en .env.local y reiniciá el panel:\nTELEGRAM_ALLOWED_USERS=${userId}`);
    return;
  }
  if (!context.allowed.has(userId)) return;
  try {
    const text = message.text?.trim() || (await readAudio(context, message));
    if (!text) return void (await context.api.sendMessage(chatId, "Mandame un mensaje de texto o un audio."));
    if (/^\/(start|ayuda|help)\b/i.test(text)) {
      forget(chatId);
      return void (await context.api.sendMessage(chatId, helpText(context.brands(), context.modelLabel)));
    }
    await handleText(context, chatId, text);
  } catch (error) {
    await context.api.sendMessage(chatId, error instanceof Error ? error.message : "Algo salió mal.");
  }
}

/** Botones de aprobación: "ok:<campaña>" programa, "no:<campaña>" cancela. */
export async function handleCallback(context: BotContext, callback: TelegramCallback): Promise<void> {
  if (!context.allowed.has(callback.from.id)) return;
  const match = /^(ok|no):([0-9a-f-]{36})$/.exec(callback.data || "");
  const chatId = callback.message?.chat.id;
  if (!match || !chatId) return void (await context.api.answerCallback(callback.id));
  await context.api.answerCallback(callback.id, match[1] === "ok" ? "Programando…" : "Cancelado");
  if (callback.message) await context.api.clearButtons(chatId, callback.message.message_id).catch(() => undefined);
  try {
    if (match[1] === "no") {
      await cancelCampaign(match[2]);
      await context.api.sendMessage(chatId, "Listo, no programé nada. Los flyers quedan en el panel por si querés usarlos.");
      return;
    }
    await scheduleCampaign(match[2], context.campaignDeps());
  } catch (error) {
    await context.api.sendMessage(chatId, error instanceof Error ? error.message : "Algo salió mal.");
  }
}
