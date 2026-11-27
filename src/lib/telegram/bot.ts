import fs from "node:fs";
import path from "node:path";
import { settleInterrupted, type CampaignDeps, type Notifier } from "../agent/campaign";
import { agentModel, createAgentAsk, describeModel } from "../agent/provider";
import { agentDir, readCampaigns } from "../agent/store";
import { transcribe } from "../agent/transcribe";
import { notifyOutcomes } from "../agent/watch";
import { loadFlyerBrand, readBrands } from "../flyers/brand";
import { animateFlyer } from "../flyers/motion";
import { startFlyerJob } from "../flyers/pipeline";
import { readFlyerFile, readJobs } from "../flyers/store";
import { readJson, writeJson } from "../json-store";
import { getAllPages } from "../pages-server";
import { createScheduledPost } from "../schedule-service";
import { readDB } from "../scheduler";
import { TelegramApi } from "./api";
import { handleCallback, handleMessage, type BotContext } from "./handlers";

const WATCH_MS = 60_000;
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;

const worker = globalThis as typeof globalThis & { saasTelegram?: boolean };

function log(error: unknown): void {
  console.error("[Telegram]", error instanceof Error ? error.message : "Error del bot");
}

/** Ids de Telegram autorizados, separados por coma. */
export function allowedUsers(value = process.env.TELEGRAM_ALLOWED_USERS): Set<number> {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  );
}

function stateFile(): string {
  fs.mkdirSync(agentDir(), { recursive: true });
  return path.join(agentDir(), "telegram.json");
}

function createNotifier(api: TelegramApi): Notifier {
  return {
    text: async (chatId, text) => void (await api.sendMessage(chatId, text)),
    approval: async (chatId, id, text) =>
      void (await api.sendMessage(chatId, text, [[{ text: "Programar todo", data: `ok:${id}` }, { text: "Cancelar", data: `no:${id}` }]])),
    preview: async (chatId, pieces) => {
      const photos = pieces.filter((piece) => piece.image).map((piece) => ({ data: piece.image!, caption: piece.caption }));
      if (photos.length) await api.sendPhotos(chatId, photos);
      for (const piece of pieces.filter((item) => item.videoPath)) await api.sendVideo(chatId, piece.videoPath!, piece.caption);
    },
  };
}

function campaignDeps(notify: Notifier): CampaignDeps {
  return {
    loadBrand: loadFlyerBrand,
    startJob: startFlyerJob,
    readJobs,
    animate: animateFlyer,
    schedule: createScheduledPost,
    readImage: (flyerId) => readFlyerFile(flyerId, "imagen"),
    videoFile: (url) => path.join(process.cwd(), "public", url.replace(/^\/+/, "")),
    notify,
    flyerModel: agentModel().flyerModel,
    autoApprove: process.env.AGENT_AUTO_APPROVE === "true",
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date(),
  };
}

function createContext(api: TelegramApi): BotContext {
  const notify = createNotifier(api);
  const model = agentModel();
  return {
    api,
    allowed: allowedUsers(),
    ask: createAgentAsk(model),
    modelLabel: describeModel(model),
    brands: () => readBrands().map((brand) => ({ id: brand.id, name: brand.name })),
    posts: readDB,
    pageNames: () => new Map(getAllPages().map((page) => [page.id, page.name])),
    transcribe: (audio) => transcribe(audio),
    campaignDeps: () => campaignDeps(notify),
  };
}

async function poll(api: TelegramApi, context: BotContext): Promise<never> {
  let offset = readJson<{ offset?: number }>(stateFile(), {}).offset ?? 0;
  let retry = RETRY_MIN_MS;
  for (;;) {
    try {
      const updates = await api.getUpdates(offset);
      retry = RETRY_MIN_MS;
      for (const update of updates) {
        offset = update.update_id + 1;
        writeJson(stateFile(), { offset });
        // Cada mensaje en segundo plano: un pedido largo no frena los botones.
        if (update.message) void handleMessage(context, update.message).catch(log);
        if (update.callback_query) void handleCallback(context, update.callback_query).catch(log);
      }
    } catch (error) {
      log(error);
      await new Promise((resolve) => setTimeout(resolve, retry));
      retry = Math.min(RETRY_MAX_MS, retry * 2);
    }
  }
}

/**
 * Arranca el bot si hay token. Usa "long polling": la PC le pregunta a
 * Telegram si hay mensajes, sin abrir puertos ni exponer el panel.
 */
export function startTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  // Las vistas previas y los tests apagan el programador: el bot tampoco corre ahí.
  if (!token || process.env.SCHEDULER_ENABLED === "false" || worker.saasTelegram) return;
  worker.saasTelegram = true;
  const api = new TelegramApi(token);
  const context = createContext(api);
  const notify = createNotifier(api);
  void settleInterrupted(notify, readCampaigns()).catch(log);
  const watch = setInterval(() => void notifyOutcomes(readDB(), notify).catch(log), WATCH_MS);
  watch.unref();
  void poll(api, context);
  console.info("[Telegram] Bot activo", context.allowed.size ? `para ${context.allowed.size} usuario(s)` : "sin usuarios autorizados todavía");
}
