import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { normalizeIntent, type CampaignRequest } from "../src/lib/agent/intent";
import { agentModel } from "../src/lib/agent/provider";
import { planSlots, readTime, readTimes } from "../src/lib/agent/slots";
import type { Flyer, FlyerJob } from "../src/lib/flyers/types";
import type { ScheduledPost } from "../src/lib/schedule-types";
import { FLYER_SAMPLES } from "./flyer-samples";

const BRANDS = [
  { id: "obsidiana", name: "Obsidiana" },
  { id: "neurocortex", name: "Neurocortex" },
];
// Miércoles 26/11/2026, 10:00 hora local.
const NOW = new Date(2026, 10, 26, 10, 0, 0);

test("el pedido se convierte en una campaña validada", () => {
  const intent = normalizeIntent(
    JSON.stringify({ action: "campaign", brandId: "Obsidiana", flyers: 10, videos: 5, days: 3, startDate: null, format: "9:16", brief: "stock" }),
    BRANDS,
    NOW,
  );
  assert.deepEqual(intent, {
    kind: "campaign",
    request: { brandId: "obsidiana", images: 10, videos: 5, days: 3, startDate: null, brief: "stock", format: "9:16", style: "auto", templates: [], times: [] },
  });
});

test("el agente pregunta en vez de inventar", () => {
  const ask = (data: object) => normalizeIntent(JSON.stringify({ action: "campaign", ...data }), BRANDS, NOW);
  assert.match((ask({ brandId: "otra", flyers: 2 }) as { text: string }).text, /¿Para qué marca\?/);
  assert.match((ask({ brandId: "obsidiana" }) as { text: string }).text, /¿Cuántos/);
  assert.match((ask({ brandId: "obsidiana", flyers: 40 }) as { text: string }).text, /hasta 30/);
  assert.match((ask({ brandId: "obsidiana", flyers: 20, days: 2 }) as { text: string }).text, /más de 6 publicaciones por día/);
  assert.equal(normalizeIntent("esto no es json", BRANDS, NOW).kind, "question");
  const past = ask({ brandId: "obsidiana", flyers: 1, startDate: "2020-01-01", format: "3:2" });
  assert.equal(past.kind === "campaign" && past.request.startDate, null, "una fecha pasada se ignora");
  assert.equal(past.kind === "campaign" && past.request.format, "4:5");
});

test("los horarios se reparten parejo y los videos no se amontonan", () => {
  const slots = planSlots({ images: 10, videos: 5, days: 3, startDate: null }, NOW);
  assert.equal(slots.length, 15);
  assert.deepEqual(
    slots.slice(0, 5).map((slot) => [slot.at.getDate(), slot.at.getHours()]),
    [[27, 9], [27, 12], [27, 15], [27, 18], [27, 21]],
    "empieza mañana, cinco por día",
  );
  assert.equal(slots[14].at.getDate(), 29);
  assert.equal(slots.map((slot) => slot.media[0]).join(""), "iiv".repeat(5));
  const videos = slots.map((slot, index) => (slot.media === "video" ? index : -1)).filter((index) => index >= 0);
  assert.equal(videos.length, 5);
  assert.ok(videos.every((position, index) => index === 0 || position - videos[index - 1] === 3), "un video cada tres piezas");
});

test("entiende diseños y horarios pedidos, y estira los días si no alcanzan", () => {
  const intent = normalizeIntent(
    JSON.stringify({ action: "campaign", brandId: "obsidiana", flyers: 6, videos: 0, days: 2, templates: ["chat", "CHAT", "inventado", "foto"], times: ["18:00", "9", "25:00", "09:00"] }),
    BRANDS,
    NOW,
  );
  assert.equal(intent.kind, "campaign");
  if (intent.kind !== "campaign") return;
  assert.deepEqual(intent.request.templates, ["chat", "foto"], "solo diseños que existen, sin repetir");
  assert.deepEqual(intent.request.times, ["09:00", "18:00"], "horas válidas, ordenadas y sin repetir");
  assert.equal(intent.request.days, 3, "6 piezas a 2 horarios por día necesitan 3 días");
  const tooLong = normalizeIntent(JSON.stringify({ action: "campaign", brandId: "obsidiana", flyers: 20, days: 1, times: ["10:00"] }), BRANDS, NOW);
  assert.match((tooLong as { text: string }).text, /serían 20 días; el máximo es 14/);
});

test("las horas se leen en varios formatos", () => {
  assert.equal(readTime("9"), "09:00");
  assert.equal(readTime("20.30"), "20:30");
  assert.equal(readTime("21:15 hs"), "21:15");
  assert.equal(readTime("24:00"), null);
  assert.equal(readTime("tarde"), null);
  assert.deepEqual(readTimes(["1", "2", "3", "4", "5", "6", "7"]).length, 6, "como mucho seis por día");
});

test("con horarios pedidos, cada día sale a esas horas", () => {
  const slots = planSlots({ images: 5, videos: 0, days: 3, startDate: null, times: ["10:00", "20:30"] }, NOW);
  assert.deepEqual(
    slots.map((slot) => `${slot.at.getDate()} ${slot.at.getHours()}:${String(slot.at.getMinutes()).padStart(2, "0")}`),
    ["27 10:00", "27 20:30", "28 10:00", "28 20:30", "29 10:00"],
  );
});

test("si hoy ya es tarde, los horarios que no llegan pasan al día siguiente", () => {
  const late = new Date(2026, 10, 26, 17, 30);
  const slots = planSlots({ images: 4, videos: 0, days: 1, startDate: "2026-11-26" }, late);
  assert.deepEqual(
    slots.map((slot) => `${slot.at.getDate()} ${slot.at.getHours()}`),
    ["26 20", "27 9", "27 12", "27 16"],
  );
});

test("Claude es el modelo por defecto y se puede pasar a local", () => {
  assert.deepEqual(agentModel({}), { provider: "claude", model: "claude-sonnet-5-5", flyerModel: "claude-sonnet-5-5" });
  assert.deepEqual(agentModel({ AGENT_PROVIDER: "ollama", LOCAL_LLM_MODEL: "qwen3:14b" }), {
    provider: "ollama",
    model: "qwen3:14b",
    flyerModel: "ollama:qwen3:14b",
  });
  assert.equal(agentModel({ AGENT_MODEL: "gpt-4" }).model, "claude-sonnet-5-5", "un modelo desconocido no se usa");
});

test("la charla se recuerda media hora y se puede olvidar", async () => {
  const talk = await import("../src/lib/agent/conversation");
  const start = 1_000_000;
  talk.remember(42, "user", "para Obsidiana, impulsar el registro", start);
  talk.remember(42, "agent", "¿Cuántos flyers y videos?", start + 1_000);
  assert.equal(
    talk.transcript(talk.history(42, start + 2_000)),
    "Usuario: para Obsidiana, impulsar el registro\nAgente: ¿Cuántos flyers y videos?",
  );
  assert.deepEqual(talk.history(42, start + 1_000 + talk.CONVERSATION_TTL_MS + 1), [], "vence después de 30 minutos");
  assert.deepEqual(talk.history(43, start), [], "cada chat tiene la suya");
  talk.forget(42);
  assert.deepEqual(talk.history(42, start + 2_000), []);
});

test("el segundo mensaje llega al modelo con la charla previa", async () => {
  const { intentMessage } = await import("../src/lib/agent/intent");
  assert.equal(intentMessage("hola", ""), "hola");
  assert.match(intentMessage("dos flyers", "Usuario: Obsidiana\nAgente: ¿Cuántos?"), /^Charla previa:\nUsuario: Obsidiana\nAgente: ¿Cuántos\?\n\nMensaje nuevo del usuario:\ndos flyers$/);
});

test("las rutas de Windows se escapan para el filtro whisper de ffmpeg", async () => {
  const { filterValue } = await import("../src/lib/agent/transcribe");
  assert.equal(filterValue("D:\\models\\ggml.bin"), "D\\\\:/models/ggml.bin");
  assert.equal(filterValue("a'b,c;d[e]"), "a\\\\'b\\\\,c\\\\;d\\\\[e\\\\]");
});

// ---- Campaña completa con dependencias falsas: nada sale de la PC ----

const previousDirectory = process.cwd();
const directory = mkdtempSync(path.join(os.tmpdir(), "hub-agent-"));
let campaign: typeof import("../src/lib/agent/campaign");
let store: typeof import("../src/lib/agent/store");
let watch: typeof import("../src/lib/agent/watch");
let bot: typeof import("../src/lib/telegram/bot");
let handlers: typeof import("../src/lib/telegram/handlers");

before(async () => {
  process.chdir(directory);
  campaign = await import("../src/lib/agent/campaign");
  store = await import("../src/lib/agent/store");
  watch = await import("../src/lib/agent/watch");
  bot = await import("../src/lib/telegram/bot");
  handlers = await import("../src/lib/telegram/handlers");
});
after(() => {
  process.chdir(previousDirectory);
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
  } catch {
    // Windows puede demorar en soltar los archivos.
  }
});

let postCounter = 0;

function fakeDeps() {
  const jobs: FlyerJob[] = [];
  const said: string[] = [];
  const scheduled: Array<{ media: string; at: string; caption: string; source?: string }> = [];
  let previews = 0;
  let approvals = 0;
  let counter = 0;
  const flyer = (index: number): Flyer => ({
    id: `00000000-0000-0000-0000-${String(++counter).padStart(12, "0")}`,
    concept: { ...FLYER_SAMPLES[index % FLYER_SAMPLES.length], caption: `texto ${counter}` },
    format: "4:5",
    hasAsset: false,
    revision: 1,
  });
  const templatesAsked: Array<string[] | undefined> = [];
  const deps = {
    loadBrand: (id: string) => ({ id, name: "Obsidiana", website: "", description: "", audience: "", valueProposition: "", voice: "", primary: "#000", accent: "#fff", headingFont: "Inter" }),
    startJob: async (input: { templates?: string[] }) => {
      templatesAsked.push(input.templates);
      const job: FlyerJob = { id: `job-${jobs.length}`, brandId: "obsidiana", brief: "", format: "4:5", model: "m", status: "done", step: "", createdAt: "", flyers: [0, 1, 2, 3].map((index) => flyer(jobs.length * 4 + index)) };
      jobs.push(job);
      return { job, done: Promise.resolve() };
    },
    readJobs: () => jobs,
    animate: async (request: { jobId: string; flyerId: string }) => {
      const job = jobs.find((item) => item.id === request.jobId)!;
      const target = job.flyers.find((item) => item.id === request.flyerId)!;
      target.video = { status: "done", seconds: 12, music: true, url: `/generated-videos/${target.id}.mp4` };
      return { job, done: Promise.resolve() };
    },
    schedule: async (input: { image?: Buffer | null; videoPath?: string | null; scheduledAt: unknown; message: string; source?: { media: string } | null }) => {
      scheduled.push({ media: input.videoPath ? "video" : input.image ? "image" : "text", at: String(input.scheduledAt), caption: input.message, source: input.source?.media });
      return { id: `sched_${++postCounter}`, status: "scheduled", scheduledAt: String(input.scheduledAt) } as ScheduledPost;
    },
    readImage: () => Buffer.from("png"),
    videoFile: (url: string) => url,
    notify: {
      text: async (_chat: number, text: string) => void said.push(text),
      preview: async () => void previews++,
      approval: async (_chat: number, _id: string, text: string) => {
        approvals++;
        said.push(text);
      },
    },
    flyerModel: "claude-sonnet-5-5",
    autoApprove: false,
    wait: async () => {},
    now: () => NOW,
  };
  return { deps, jobs, said, scheduled, templatesAsked, counts: () => ({ previews, approvals }) };
}

const REQUEST: CampaignRequest = { brandId: "obsidiana", images: 4, videos: 2, days: 2, startDate: null, brief: "", format: "4:5", style: "tranquilo", templates: ["chat"], times: [] };

test("una campaña crea, anima, pide aprobación y recién ahí programa", async () => {
  const fake = fakeDeps();
  const { campaign: started, done } = await campaign.startCampaign(7, REQUEST, fake.deps as never);
  assert.equal(campaign.isCampaignRunning(), true);
  await done;
  assert.equal(campaign.isCampaignRunning(), false);
  assert.equal(fake.jobs.length, 2, "dos tandas de cuatro para seis piezas");
  assert.deepEqual(fake.templatesAsked, [["chat"], ["chat"]], "cada tanda pide el diseño elegido");
  const review = store.findCampaign(started.id)!;
  assert.equal(review.status, "review");
  assert.equal(review.pieces.filter((piece) => piece.media === "video" && piece.videoUrl).length, 2);
  assert.deepEqual(fake.counts(), { previews: 1, approvals: 1 });
  assert.equal(fake.scheduled.length, 0, "nada se programa sin aprobación");

  await campaign.scheduleCampaign(started.id, fake.deps as never);
  assert.equal(fake.scheduled.length, 6);
  assert.equal(fake.scheduled.filter((item) => item.media === "video").length, 2);
  assert.ok(fake.scheduled.every((item) => item.source === item.media), "cada publicación sabe de qué flyer y formato sale");
  assert.ok(fake.scheduled.every((item) => Date.parse(item.at) > NOW.getTime()));
  assert.equal(store.findCampaign(started.id)!.status, "scheduled");
  assert.match(fake.said.at(-1)!, /Programé 6 de 6/);
  await assert.rejects(campaign.scheduleCampaign(started.id, fake.deps as never), /ya no está esperando/);
});

test("avisa una sola vez cuando cada publicación sale o falla", async () => {
  const fake = fakeDeps();
  const { campaign: started, done } = await campaign.startCampaign(7, { ...REQUEST, images: 2, videos: 0, days: 1 }, fake.deps as never);
  await done;
  await campaign.scheduleCampaign(started.id, fake.deps as never);
  const ids = store.findCampaign(started.id)!.pieces.map((piece) => piece.postId!);
  const posts = [
    { id: ids[0], status: "published", scheduledAt: NOW.toISOString(), permalink: "https://facebook.com/p/1" },
    { id: ids[1], status: "failed", scheduledAt: NOW.toISOString(), error: "token vencido" },
  ] as ScheduledPost[];
  const messages: string[] = [];
  const notifier = { text: async (_chat: number, text: string) => void messages.push(text), preview: async () => {}, approval: async () => {} };
  assert.equal(await watch.notifyOutcomes(posts, notifier), 2);
  assert.equal(await watch.notifyOutcomes(posts, notifier), 0, "no repite avisos");
  assert.match(messages[0], /ya salió en Facebook/);
  assert.match(messages[1], /no se pudo publicar: token vencido/);
});

test("solo los usuarios autorizados pueden dar órdenes", async () => {
  assert.deepEqual([...bot.allowedUsers("123, abc, 456,-1")], [123, 456]);
  const sent: string[] = [];
  const prompts: string[] = [];
  let asked = 0;
  const context = {
    api: { sendMessage: async (_chat: number, text: string) => void sent.push(text), sendChatAction: async () => {} },
    allowed: new Set([123]),
    ask: async (_system: string, user: string) => {
      asked++;
      prompts.push(user);
      return JSON.stringify(asked === 1 ? { action: "help" } : { action: "question", question: "¿Cuántos?" });
    },
    modelLabel: "Claude",
    brands: () => BRANDS,
    posts: () => [],
    pageNames: () => new Map(),
    transcribe: async () => "",
    campaignDeps: () => fakeDeps().deps,
  } as never as import("../src/lib/telegram/handlers").BotContext;
  await handlers.handleMessage(context, { message_id: 1, chat: { id: 9, type: "private" }, from: { id: 999 }, text: "publicá todo" });
  assert.equal(sent.length + asked, 0, "un extraño no recibe respuesta ni gasta tokens");
  await handlers.handleMessage(context, { message_id: 2, chat: { id: 9, type: "private" }, from: { id: 123 }, text: "hola" });
  assert.equal(asked, 1);
  assert.match(sent[0], /Mandame un audio o un mensaje/);
  await handlers.handleMessage(context, { message_id: 4, chat: { id: 9, type: "private" }, from: { id: 123 }, text: "para Obsidiana" });
  assert.match(prompts[1], /Usuario: hola\nAgente: \(Explicó qué puede hacer/, "el segundo mensaje lleva la charla");
  assert.match(prompts[1], /Mensaje nuevo del usuario:\npara Obsidiana$/);
  const open = { ...(context as object), allowed: new Set<number>() } as typeof context;
  await handlers.handleMessage(open, { message_id: 3, chat: { id: 9, type: "private" }, from: { id: 555 }, text: "hola" });
  assert.match(sent.at(-1)!, /TELEGRAM_ALLOWED_USERS=555/);
  assert.equal(asked, 2, "sin configurar no llama al modelo");
});
