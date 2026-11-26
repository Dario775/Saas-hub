import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import type { ScheduledPost } from "../src/lib/schedule-types";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-11-26T12:00:00Z");
const previousDirectory = process.cwd();
const previousToken = process.env.FACEBOOK_TOKEN_OBSIDIANA;
const originalFetch = globalThis.fetch;
const directory = mkdtempSync(path.join(os.tmpdir(), "hub-reconcile-"));
let scheduler: typeof import("../src/lib/scheduler");
let calls = 0;

function post(id: string, hoursAgo: number, pageId = "obsidiana"): ScheduledPost {
  return {
    id,
    pageId,
    message: "texto",
    imagePath: null,
    scheduledAt: new Date(NOW - hoursAgo * HOUR).toISOString(),
    status: "scheduled",
    createdAt: "2026-11-01T00:00:00Z",
    publishedAt: null,
    postId: `post-${id}`,
    error: null,
    fbScheduled: true,
  };
}

/** Facebook simulado: responde según el id de la publicación. */
function facebook(answers: Record<string, { status: number; published?: boolean } | "error">) {
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls += 1;
    const id = Object.keys(answers).find((key) => String(url).includes(`post-${key}?`));
    const answer = id ? answers[id] : { status: 404 };
    if (answer === "error") throw new Error("ECONNRESET");
    return Response.json(
      answer.status === 200 ? { is_published: answer.published, permalink_url: "https://fb/p" } : { error: { message: "x" } },
      { status: answer.status },
    );
  }) as typeof fetch;
}

before(async () => {
  // El archivo de la agenda se resuelve al importar: nunca el real.
  process.chdir(directory);
  process.env.FACEBOOK_TOKEN_OBSIDIANA = "token-de-prueba";
  scheduler = await import("../src/lib/scheduler");
});
beforeEach(async () => {
  calls = 0;
  await scheduler.mutateSchedule((posts) => {
    posts.splice(0, posts.length);
  });
});
after(() => {
  globalThis.fetch = originalFetch;
  process.chdir(previousDirectory);
  if (previousToken === undefined) delete process.env.FACEBOOK_TOKEN_OBSIDIANA;
  else process.env.FACEBOOK_TOKEN_OBSIDIANA = previousToken;
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
  } catch {
    // Ignorar bloqueo transitorio de temp en Windows
  }
});

const statusOf = (id: string) => scheduler.readDB().find((item) => item.id === id);

test("lo que Facebook confirma pasa a publicado, aunque sea viejo", async () => {
  await scheduler.mutateSchedule((posts) => posts.push(post("a", 1), post("b", 100)));
  facebook({ a: { status: 200, published: true }, b: { status: 200, published: true } });
  await scheduler.reconcileNativePosts(NOW);
  assert.equal(statusOf("a")?.status, "published");
  assert.equal(statusOf("b")?.status, "published");
  assert.equal(statusOf("b")?.permalink, "https://fb/p");
});

test("dentro del plazo se sigue esperando la confirmación", async () => {
  await scheduler.mutateSchedule((posts) => posts.push(post("a", 2), post("b", 3)));
  facebook({ a: { status: 200, published: false }, b: "error" });
  await scheduler.reconcileNativePosts(NOW);
  assert.equal(statusOf("a")?.status, "scheduled");
  assert.equal(statusOf("b")?.status, "scheduled");
});

test("pasado el plazo, lo no confirmado pasa a revisión con el motivo", async () => {
  await scheduler.mutateSchedule((posts) => posts.push(post("a", 30), post("b", 30), post("c", 30, "pagina-borrada")));
  facebook({ a: { status: 200, published: false }, b: { status: 400 } });
  await scheduler.reconcileNativePosts(NOW);
  assert.equal(statusOf("a")?.status, "failed");
  assert.match(statusOf("a")?.error || "", /no confirmó/);
  assert.equal(statusOf("b")?.status, "failed");
  assert.match(statusOf("b")?.error || "", /Reconectá la página/);
  assert.equal(statusOf("c")?.status, "failed");
  // Una vez en revisión, no se vuelve a consultar.
  calls = 0;
  await scheduler.reconcileNativePosts(NOW);
  assert.equal(calls, 0);
});

test("la revisión nunca vuelve a enviar la publicación", async () => {
  await scheduler.mutateSchedule((posts) => posts.push(post("a", 30)));
  const methods: string[] = [];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    methods.push(init?.method || "GET");
    return Response.json({ is_published: false });
  }) as typeof fetch;
  await scheduler.reconcileNativePosts(NOW);
  assert.deepEqual(methods, ["GET"]);
});

test("no toca las que no son programaciones nativas ni las futuras", async () => {
  await scheduler.mutateSchedule((posts) => posts.push({ ...post("a", 30), fbScheduled: false }, post("b", -5)));
  facebook({});
  await scheduler.reconcileNativePosts(NOW);
  assert.equal(statusOf("a")?.status, "scheduled");
  assert.equal(statusOf("b")?.status, "scheduled");
  assert.equal(calls, 0);
});
