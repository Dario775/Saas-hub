import path from "node:path";
import "server-only";
import { readJson, withFileLock, writeJson } from "./json-store";
import { getAllPages } from "./pages-server";
import type { ScheduledPost } from "./schedule-types";
import { dispatchToSocialNetworks } from "./social-dispatcher";

const DB_PATH = path.join(process.cwd(), "scheduled-posts.json");
export function readDB(): ScheduledPost[] {
  const posts = readJson<ScheduledPost[]>(DB_PATH, []);
  if (!Array.isArray(posts))
    throw new Error("El calendario guardado no tiene un formato válido.");
  return posts;
}
export async function mutateSchedule<T>(
  mutate: (posts: ScheduledPost[]) => T,
): Promise<T> {
  return withFileLock(DB_PATH, async () => {
    const posts = readDB();
    const result = mutate(posts);
    writeJson(DB_PATH, posts);
    return result;
  });
}

export async function runPendingScheduledPosts(onlyId?: string) {
  const claimed = await mutateSchedule((posts) => {
    const now = Date.now();
    for (const post of posts) {
      if (
        post.status === "publishing" &&
        post.processingAt &&
        now - Date.parse(post.processingAt) > 15 * 60_000
      ) {
        post.status = "failed";
        post.error =
          "Se interrumpió el envío. Revisá Facebook antes de reintentar para evitar duplicados.";
      }
    }
    const pending = posts.filter(
      (post) =>
        post.status === "pending" &&
        !post.fbScheduled &&
        Date.parse(post.scheduledAt) <= now &&
        (!onlyId || post.id === onlyId),
    );
    // Persist the claim before any network I/O. Other workers skip these records.
    pending.forEach((post) => {
      post.status = "publishing";
      post.processingAt = new Date().toISOString();
    });
    return pending.map((post) => ({ ...post }));
  });

  const published: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const post of claimed) {
    let dispatchResult: Awaited<ReturnType<typeof dispatchToSocialNetworks>> | undefined;
    let globalError: string | undefined;

    try {
      const page = getAllPages().find((page) => page.id === post.pageId);
      if (!page)
        throw new Error("La página de esta publicación ya no está conectada.");

      const platforms =
        post.platforms && post.platforms.length > 0
          ? post.platforms
          : ["facebook"];

      dispatchResult = await dispatchToSocialNetworks(page, post, platforms);
    } catch (cause) {
      globalError =
        cause instanceof Error
          ? cause.message
          : "No se pudo completar la publicación.";
    }

    await mutateSchedule((posts) => {
      const target = posts.find((item) => item.id === post.id);
      if (!target) return;

      if (dispatchResult) {
        target.status = dispatchResult.hasSuccess ? "published" : "failed";
        target.error = dispatchResult.allSucceeded
          ? null
          : `${dispatchResult.errors.join(" | ")} Revisá Facebook antes de volver a enviar.`;
        target.platformResults = dispatchResult.platformResults;
        if (dispatchResult.hasSuccess) {
          target.postId = dispatchResult.primaryId;
          target.permalink = dispatchResult.primaryPermalink;
          target.publishedAt = new Date().toISOString();
        }
      } else {
        target.status = "failed";
        target.error = globalError
          ? `${globalError} Revisá Facebook antes de volver a enviar.`
          : "Fallo inesperado. Revisá Facebook antes de volver a enviar.";
      }
    });

    if (dispatchResult?.hasSuccess) published.push(post.id);
    else failed.push({ id: post.id, error: globalError || dispatchResult?.errors.join(" | ") || "Error de publicación" });
  }
  return { ranCount: claimed.length, published, failed };
}

async function reconcileNativePosts() {
  const due = readDB().filter(
    (post) =>
      post.fbScheduled &&
      post.status === "scheduled" &&
      Date.parse(post.scheduledAt) < Date.now(),
  );
  for (const post of due) {
    const page = getAllPages().find((page) => page.id === post.pageId);
    if (!page || !post.postId) continue;
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${post.postId}?fields=is_published,permalink_url`,
        {
          headers: { Authorization: `Bearer ${page.accessToken}` },
          signal: AbortSignal.timeout(8_000),
        },
      );
      const data = await response.json();
      if (response.ok && data.is_published)
        await mutateSchedule((posts) => {
          const target = posts.find((item) => item.id === post.id);
          if (target?.status === "scheduled") {
            target.status = "published";
            target.publishedAt = new Date().toISOString();
            target.permalink = data.permalink_url || null;
          }
        });
    } catch {
      /* A failed status read must never trigger another publication. */
    }
  }
}

const worker = globalThis as typeof globalThis & {
  saasScheduler?: ReturnType<typeof setInterval>;
  saasSchedulerBusy?: boolean;
};
export function startScheduler() {
  if (process.env.SCHEDULER_ENABLED === "false" || worker.saasScheduler) return;
  async function tick() {
    if (worker.saasSchedulerBusy) return;
    worker.saasSchedulerBusy = true;
    try {
      await runPendingScheduledPosts();
      await reconcileNativePosts();
    } catch (error) {
      console.error(
        "[Scheduler]",
        error instanceof Error ? error.message : "Error de calendario",
      );
    } finally {
      worker.saasSchedulerBusy = false;
    }
  }
  worker.saasScheduler = setInterval(() => void tick(), 30_000);
  worker.saasScheduler.unref();
  void tick();
}
