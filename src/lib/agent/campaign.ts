import { randomUUID } from "node:crypto";
import type { animateFlyer } from "../flyers/motion";
import type { startFlyerJob } from "../flyers/pipeline";
import type { Flyer, FlyerBrand, FlyerJob } from "../flyers/types";
import type { createScheduledPost } from "../schedule-service";
import type { MotionStyleChoice } from "../motion/styles";
import type { CampaignRequest } from "./intent";
import { formatSlot, planSlots } from "./slots";
import { findCampaign, saveCampaign, updateCampaign, type Campaign, type CampaignPiece } from "./store";

const FLYERS_PER_JOB = 4;
const VIDEO_SECONDS = 12;
const BUSY_RETRY_MS = 20_000;
const BUSY_ATTEMPTS = 30;
/** Diseños que mejor lucen animados (tienen el gancho completo). */
const ANIMATED_FIRST = ["chat", "ventana", "red", "comparativa", "pasos", "planilla", "foto"];

/** Cómo el agente le habla al usuario. Telegram lo implementa; los tests lo simulan. */
export interface Notifier {
  text(chatId: number, text: string): Promise<void>;
  preview(chatId: number, pieces: Array<{ image?: Buffer; videoPath?: string; caption: string }>): Promise<void>;
  approval(chatId: number, campaignId: string, text: string): Promise<void>;
}

export interface CampaignDeps {
  loadBrand(id: string): FlyerBrand;
  startJob: typeof startFlyerJob;
  readJobs(): FlyerJob[];
  animate: typeof animateFlyer;
  schedule: typeof createScheduledPost;
  readImage(flyerId: string): Buffer | null;
  /** Ruta en disco de un video público. */
  videoFile(url: string): string;
  notify: Notifier;
  flyerModel: string;
  autoApprove: boolean;
  wait(ms: number): Promise<void>;
  now(): Date;
}

const worker = globalThis as typeof globalThis & { saasAgentBusy?: boolean };

export function isCampaignRunning(): boolean {
  return Boolean(worker.saasAgentBusy);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Algo salió mal.";
}

function busy(error: unknown): boolean {
  return /Ya hay (flyers|un video)/.test(message(error));
}

/** Reintenta mientras el panel esté ocupado con otro trabajo (por ejemplo, desde la web). */
async function whenFree<T>(deps: CampaignDeps, action: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (!busy(error) || attempt >= BUSY_ATTEMPTS) throw error;
      await deps.wait(BUSY_RETRY_MS);
    }
  }
}

function step(id: string, text: string): Promise<Campaign> {
  return updateCampaign(id, (campaign) => ({ ...campaign, step: text }));
}

function brief(request: CampaignRequest, brand: FlyerBrand, batch: number): string {
  const base = request.brief || `Publicaciones variadas para las redes de ${brand.name}: mostrá distintos problemas concretos que resuelve.`;
  return batch === 0 ? base : `${base}\n\nEsta es otra tanda de la misma campaña: ideas y diseños distintos a los anteriores.`;
}

/** Genera flyers de a tandas hasta juntar los que hacen falta. */
async function produceFlyers(campaign: Campaign, brand: FlyerBrand, deps: CampaignDeps): Promise<Array<{ job: FlyerJob; flyer: Flyer }>> {
  const needed = campaign.request.images + campaign.request.videos;
  const maxBatches = Math.ceil(needed / FLYERS_PER_JOB) + 2;
  const found: Array<{ job: FlyerJob; flyer: Flyer }> = [];
  for (let batch = 0; found.length < needed && batch < maxBatches; batch++) {
    await step(campaign.id, `Creando flyers (${found.length} de ${needed})`);
    const { job, done } = await whenFree(deps, () =>
      deps.startJob({
        brand,
        brief: brief(campaign.request, brand, batch),
        format: campaign.request.format,
        model: deps.flyerModel,
        templates: campaign.request.templates,
      }),
    );
    await done;
    const finished = deps.readJobs().find((item) => item.id === job.id);
    for (const flyer of finished?.flyers ?? []) if (flyer.revision > 0 && found.length < needed) found.push({ job: finished!, flyer });
  }
  if (found.length < needed) throw new Error(`Solo salieron ${found.length} de ${needed} flyers. Probá de nuevo o pedí menos.`);
  return found;
}

/** Elige qué flyers se animan: primero los diseños que mejor lucen en movimiento. */
function chooseVideos(flyers: Array<{ job: FlyerJob; flyer: Flyer }>, videos: number): Set<string> {
  const rank = (template: string) => {
    const index = ANIMATED_FIRST.indexOf(template);
    return index < 0 ? ANIMATED_FIRST.length : index;
  };
  const sorted = [...flyers].sort((a, b) => rank(a.flyer.concept.template) - rank(b.flyer.concept.template));
  return new Set(sorted.slice(0, videos).map((item) => item.flyer.id));
}

async function animatePiece(piece: CampaignPiece, brand: FlyerBrand, style: MotionStyleChoice, deps: CampaignDeps): Promise<CampaignPiece> {
  try {
    const { done } = await whenFree(deps, () =>
      deps.animate({ jobId: piece.jobId, flyerId: piece.flyerId, brand, seconds: VIDEO_SECONDS, music: true, style }),
    );
    await done;
    const flyer = deps.readJobs().find((job) => job.id === piece.jobId)?.flyers.find((item) => item.id === piece.flyerId);
    if (flyer?.video?.status !== "done" || !flyer.video.url) throw new Error(flyer?.video?.error || "El video no se pudo crear.");
    return { ...piece, videoUrl: flyer.video.url };
  } catch (error) {
    // Un video fallido no frena la campaña: esa pieza sale como imagen.
    console.error("[Agente]", message(error));
    return { ...piece, media: "image" };
  }
}

function planText(campaign: Campaign, brand: FlyerBrand, now: Date): string {
  const slots = planSlots({ ...campaign.request, images: count(campaign, "image"), videos: count(campaign, "video") }, now);
  const lines = slots.map((slot) => `• ${formatSlot(slot.at)} — ${slot.media === "video" ? "video" : "imagen"}`);
  const fallback = campaign.request.videos - count(campaign, "video");
  const note = fallback > 0 ? `\n${fallback} video(s) no se pudieron armar y salen como imagen.` : "";
  return `Listo: ${campaign.pieces.length} piezas para ${brand.name}.${note}\n\nAsí se publicarían en Facebook:\n${lines.join("\n")}`;
}

function count(campaign: Campaign, media: CampaignPiece["media"]): number {
  return campaign.pieces.filter((piece) => piece.media === media).length;
}

async function sendPreview(campaign: Campaign, deps: CampaignDeps): Promise<void> {
  const pieces = campaign.pieces.map((piece) =>
    piece.media === "video" && piece.videoUrl
      ? { videoPath: deps.videoFile(piece.videoUrl), caption: piece.caption }
      : { image: deps.readImage(piece.flyerId) ?? undefined, caption: piece.caption },
  );
  await deps.notify.preview(campaign.chatId, pieces);
}

async function generate(id: string, deps: CampaignDeps): Promise<void> {
  let campaign = findCampaign(id)!;
  const brand = deps.loadBrand(campaign.request.brandId);
  const flyers = await produceFlyers(campaign, brand, deps);
  const videoIds = chooseVideos(flyers, campaign.request.videos);
  let pieces: CampaignPiece[] = flyers.map(({ job, flyer }) => ({
    jobId: job.id,
    flyerId: flyer.id,
    media: videoIds.has(flyer.id) ? "video" : "image",
    caption: flyer.concept.caption,
  }));
  let made = 0;
  for (const [index, piece] of pieces.entries()) {
    if (piece.media !== "video") continue;
    await step(id, `Animando videos (${made} de ${videoIds.size})`);
    const animated = await animatePiece(piece, brand, campaign.request.style ?? "auto", deps);
    pieces = pieces.map((item, position) => (position === index ? animated : item));
    made++;
  }
  campaign = await updateCampaign(id, (current) => ({ ...current, pieces, status: "review", step: "Esperando tu aprobación" }));
  await sendPreview(campaign, deps);
  if (deps.autoApprove) {
    await scheduleCampaign(id, deps);
    return;
  }
  await deps.notify.approval(campaign.chatId, id, planText(campaign, brand, deps.now()));
}

/** Arranca una campaña en segundo plano. Devuelve enseguida. */
export async function startCampaign(chatId: number, request: CampaignRequest, deps: CampaignDeps): Promise<{ campaign: Campaign; done: Promise<void> }> {
  if (worker.saasAgentBusy) throw new Error("Ya estoy trabajando en otro pedido. Te aviso cuando termine.");
  deps.loadBrand(request.brandId);
  worker.saasAgentBusy = true;
  const campaign: Campaign = {
    id: randomUUID(),
    chatId,
    request,
    status: "generating",
    step: "Empezando",
    createdAt: deps.now().toISOString(),
    pieces: [],
  };
  try {
    await saveCampaign(campaign);
  } catch (error) {
    worker.saasAgentBusy = false;
    throw error;
  }
  const done = generate(campaign.id, deps)
    .catch(async (error) => {
      await updateCampaign(campaign.id, (current) => ({ ...current, status: "failed", step: "", error: message(error) }));
      await deps.notify.text(chatId, `No pude terminar el pedido: ${message(error)}`);
    })
    .finally(() => {
      worker.saasAgentBusy = false;
    });
  return { campaign, done };
}

/** Programa en Facebook las piezas de una campaña aprobada. */
export async function scheduleCampaign(id: string, deps: CampaignDeps): Promise<Campaign> {
  const claimed = await updateCampaign(id, (current) => {
    if (current.status !== "review") throw new Error("Esta campaña ya no está esperando aprobación.");
    return { ...current, status: "scheduling", step: "Programando" };
  });
  const slots = planSlots({ ...claimed.request, images: count(claimed, "image"), videos: count(claimed, "video") }, deps.now());
  const byMedia = { image: claimed.pieces.filter((piece) => piece.media === "image"), video: claimed.pieces.filter((piece) => piece.media === "video") };
  const ordered = slots.map((slot) => ({ slot, piece: byMedia[slot.media].shift()! }));
  const pieces: CampaignPiece[] = [];
  const errors: string[] = [];
  for (const { slot, piece } of ordered) {
    try {
      const post = await deps.schedule({
        pageId: claimed.request.brandId,
        message: piece.caption,
        scheduledAt: slot.at.toISOString(),
        image: piece.media === "image" ? deps.readImage(piece.flyerId) : null,
        videoPath: piece.media === "video" ? piece.videoUrl : null,
        platforms: ["facebook"],
        source: { jobId: piece.jobId, flyerId: piece.flyerId, media: piece.media },
      });
      pieces.push({ ...piece, postId: post.id, scheduledAt: post.scheduledAt });
      if (post.status === "failed") errors.push(`${formatSlot(slot.at)}: ${post.error}`);
    } catch (error) {
      pieces.push(piece);
      errors.push(`${formatSlot(slot.at)}: ${message(error)}`);
    }
  }
  const scheduled = pieces.filter((piece) => piece.postId).length;
  const campaign = await updateCampaign(id, (current) => ({ ...current, pieces, status: scheduled ? "scheduled" : "failed", step: "" }));
  const videoNote = count(campaign, "video") ? "\nLos videos los publica el panel: dejá la PC prendida a esas horas." : "";
  const problems = errors.length ? `\n\nNo se pudieron programar:\n${errors.map((line) => `• ${line}`).join("\n")}` : "";
  await deps.notify.text(campaign.chatId, `Programé ${scheduled} de ${pieces.length} publicaciones. Te aviso cuando salga cada una.${videoNote}${problems}`);
  return campaign;
}

export async function cancelCampaign(id: string): Promise<Campaign> {
  return updateCampaign(id, (current) => {
    if (current.status !== "review") throw new Error("Esta campaña ya no se puede cancelar desde acá.");
    return { ...current, status: "cancelled", step: "" };
  });
}

/** Al reiniciar el panel, una campaña a medio generar ya no avanza. */
export async function settleInterrupted(notify: Notifier, list: Campaign[]): Promise<void> {
  if (worker.saasAgentBusy) return;
  for (const campaign of list.filter((item) => item.status === "generating" || item.status === "scheduling")) {
    await updateCampaign(campaign.id, (current) => ({ ...current, status: "failed", step: "", error: "Se reinició el panel." }));
    await notify.text(campaign.chatId, "Se reinició el panel y el pedido quedó a medias. Mandámelo de nuevo cuando quieras.");
  }
}
