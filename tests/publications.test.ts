import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIntent } from "../src/lib/agent/intent";
import { publishedSummary } from "../src/lib/agent/watch";
import { logPublished, publicationsOf, readSource } from "../src/lib/flyers/publications";
import type { Flyer } from "../src/lib/flyers/types";
import type { ScheduledPost } from "../src/lib/schedule-types";
import { FLYER_SAMPLES } from "./flyer-samples";

const JOB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const FLYER = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-2222-3333-4444-555555555555";

const flyer: Flyer = { id: FLYER, concept: FLYER_SAMPLES[0], format: "4:5", hasAsset: false, revision: 1 };

function post(id: string, status: ScheduledPost["status"], scheduledAt: string, extra: Partial<ScheduledPost> = {}): ScheduledPost {
  return {
    id,
    pageId: "obsidiana",
    message: "x",
    imagePath: null,
    scheduledAt,
    status,
    createdAt: scheduledAt,
    publishedAt: null,
    postId: null,
    error: null,
    ...extra,
  };
}

test("el origen de una publicación se valida antes de guardarse", () => {
  assert.deepEqual(readSource({ jobId: JOB, flyerId: FLYER, media: "video" }), { jobId: JOB, flyerId: FLYER, media: "video" });
  assert.equal(readSource({ jobId: JOB, flyerId: "../../etc", media: "image" }), null);
  assert.equal(readSource({ jobId: JOB, flyerId: FLYER, media: "gif" }), null);
  assert.equal(readSource(null), null);
});

test("la tarjeta junta lo programado, lo publicado y lo que falló, lo más nuevo primero", () => {
  const posts = [
    post("a", "scheduled", "2026-12-01T12:00:00.000Z", { source: { jobId: JOB, flyerId: FLYER, media: "image" }, fbScheduled: true }),
    post("b", "published", "2026-11-20T12:00:00.000Z", {
      publishedAt: "2026-11-20T12:00:05.000Z",
      permalink: "https://facebook.com/p/1",
      source: { jobId: JOB, flyerId: FLYER, media: "video" },
    }),
    post("c", "failed", "2026-11-25T12:00:00.000Z", { source: { jobId: JOB, flyerId: FLYER, media: "image" } }),
    post("d", "published", "2026-11-26T12:00:00.000Z", { source: { jobId: JOB, flyerId: OTHER, media: "image" } }),
    post("e", "pending", "2026-11-27T12:00:00.000Z"),
  ];
  const logged = logPublished(flyer, { media: "image", pageId: "obsidiana", at: "2026-11-22T10:00:00.000Z", permalink: "https://facebook.com/p/2" });
  const list = publicationsOf(logged, posts);
  assert.deepEqual(
    list.map((item) => `${item.media} ${item.status} ${item.at.slice(0, 10)}`),
    ["image scheduled 2026-12-01", "image failed 2026-11-25", "image published 2026-11-22", "video published 2026-11-20"],
  );
  assert.equal(list[3].permalink, "https://facebook.com/p/1");
  assert.equal(publicationsOf(flyer, []).length, 0);
});

test("el registro de publicaciones al instante no crece sin límite", () => {
  let current = flyer;
  for (let index = 0; index < 30; index++) current = logPublished(current, { media: "image", pageId: "x", at: new Date(index).toISOString() });
  assert.equal(current.published!.length, 20);
  assert.equal(current.published![0].at, new Date(29).toISOString(), "el más reciente primero");
});

test("el bot lista lo publicado en el período pedido, con links", () => {
  const now = new Date("2026-11-26T15:00:00.000Z");
  const posts = [
    post("a", "published", "2026-11-25T12:00:00.000Z", { publishedAt: "2026-11-25T12:00:03.000Z", permalink: "https://facebook.com/p/1", mediaType: "video" }),
    post("b", "published", "2026-11-01T12:00:00.000Z", { publishedAt: "2026-11-01T12:00:00.000Z" }),
    post("c", "scheduled", "2026-11-27T12:00:00.000Z"),
  ];
  const names = new Map([["obsidiana", "Obsidiana"]]);
  const week = publishedSummary(posts, names, now, 7);
  assert.match(week, /^Publicado en los últimos 7 días \(1\):/);
  assert.match(week, /Obsidiana \(video\)\n {2}https:\/\/facebook\.com\/p\/1/);
  assert.match(publishedSummary(posts, names, now, 30), /\(2\):/);
  assert.equal(publishedSummary([], names, now, 1), "No salió nada hoy.");
  assert.equal(publishedSummary([], names, now, 7), "No salió nada en los últimos 7 días.");
  assert.deepEqual(normalizeIntent(JSON.stringify({ action: "published", days: 30 }), [], now), { kind: "published", days: 30 });
  assert.deepEqual(normalizeIntent(JSON.stringify({ action: "published" }), [], now), { kind: "published", days: 7 });
});
