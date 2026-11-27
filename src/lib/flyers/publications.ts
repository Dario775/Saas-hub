import type { PostSource, ScheduledPost } from "../schedule-types";
import type { Flyer, FlyerJob, FlyerPublication } from "./types";

const ID = /^[0-9a-f-]{36}$/i;
const MAX_LOG = 20;

/** Origen de una publicación (qué flyer y en qué formato), validado. Nulo si no viene o no es válido. */
export function readSource(value: unknown): PostSource | null {
  if (!value || typeof value !== "object") return null;
  const { jobId, flyerId, media } = value as Record<string, unknown>;
  if (typeof jobId !== "string" || typeof flyerId !== "string" || !ID.test(jobId) || !ID.test(flyerId)) return null;
  if (media !== "image" && media !== "video") return null;
  return { jobId, flyerId, media };
}

function statusOf(post: ScheduledPost): FlyerPublication["status"] {
  if (post.status === "published") return "published";
  if (post.status === "failed") return "failed";
  return "scheduled";
}

/**
 * Dónde salió (o va a salir) cada flyer. Lo programado se lee del calendario,
 * así el estado siempre está al día; lo publicado al instante queda en el flyer.
 */
export function publicationsOf(flyer: Flyer, posts: readonly ScheduledPost[]): FlyerPublication[] {
  const scheduled = posts
    .filter((post) => post.source?.flyerId === flyer.id)
    .map((post) => ({
      media: post.source!.media,
      status: statusOf(post),
      at: post.publishedAt || post.scheduledAt,
      pageId: post.pageId,
      ...(post.permalink ? { permalink: post.permalink } : {}),
    }));
  const immediate = (flyer.published ?? []).map((entry) => ({ ...entry, status: "published" as const }));
  return [...scheduled, ...immediate].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function withPublications(job: FlyerJob, posts: readonly ScheduledPost[]): FlyerJob {
  return { ...job, flyers: job.flyers.map((flyer) => ({ ...flyer, publications: publicationsOf(flyer, posts) })) };
}

export interface PublishedNow {
  media: "image" | "video";
  pageId: string;
  permalink?: string;
  at: string;
}

/** Anota una publicación hecha al instante desde el panel (las programadas ya viven en el calendario). */
export function logPublished(flyer: Flyer, entry: PublishedNow): Flyer {
  return { ...flyer, published: [entry, ...(flyer.published ?? [])].slice(0, MAX_LOG) };
}
