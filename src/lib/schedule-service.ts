import {
  fbSchedulePost,
  fbScheduleWindowOk,
  fbUploadPhotoUnpublished,
} from "@/lib/facebook-native";
import { resolvePublicMedia } from "@/lib/media-path";
import { getAllPages } from "@/lib/pages-server";
import { validatePlatforms, validateScheduleDate } from "@/lib/publish-validation";
import type { ScheduledPost } from "@/lib/schedule-types";
import { mutateSchedule } from "@/lib/scheduler";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface NewScheduledPost {
  pageId: string;
  message: string;
  scheduledAt: unknown;
  /** Imagen ya decodificada. Excluye `videoPath`. */
  image?: Buffer | null;
  /** Ruta pública de un video ya generado (/generated-videos/...). */
  videoPath?: string | null;
  platforms?: unknown;
}

function readMessage(value: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 60_000)
    throw new Error("Escribí un mensaje válido para la publicación.");
  return value.trim();
}

function saveImage(id: string, image: Buffer): string {
  const folder = path.join(process.cwd(), "public", "scheduled-images");
  fs.mkdirSync(folder, { recursive: true });
  const imagePath = `/scheduled-images/${id}.png`;
  fs.writeFileSync(resolvePublicMedia(imagePath), image);
  return imagePath;
}

function checkVideo(videoPath: string, hasImage: boolean): void {
  const resolved = resolvePublicMedia(videoPath, ["generated-videos", "scheduled-videos"]);
  if (!fs.existsSync(resolved)) throw new Error("No encontramos el video seleccionado.");
  if (hasImage) throw new Error("Elegí una imagen o un video para esta publicación.");
}

/** Pide a Facebook que publique la imagen a la hora indicada, si la ventana lo permite. */
async function scheduleNatively(post: ScheduledPost, page: ReturnType<typeof getAllPages>[number]): Promise<void> {
  if (!post.imagePath || !fbScheduleWindowOk(Date.parse(post.scheduledAt), Date.now())) return;
  let schedulingRequested = false;
  try {
    const mediaId = await fbUploadPhotoUnpublished(page, resolvePublicMedia(post.imagePath));
    schedulingRequested = true;
    post.postId = await fbSchedulePost(page, post.message, mediaId, Math.floor(Date.parse(post.scheduledAt) / 1000));
    post.fbScheduled = true;
    post.status = "scheduled";
  } catch (error) {
    // Si no llegó a pedirse, el programador del panel lo publica a su hora.
    if (schedulingRequested) {
      post.status = "failed";
      post.error = `No pudimos confirmar la programación en Facebook. Revisá Meta antes de reintentar. ${error instanceof Error ? error.message : ""}`;
    }
  }
  await mutateSchedule((posts) => {
    const saved = posts.find((item) => item.id === post.id);
    if (saved) Object.assign(saved, post);
  });
}

/**
 * Agrega una publicación al calendario. Las imágenes solo para Facebook se
 * programan en Facebook mismo; el resto lo publica el programador del panel.
 */
export async function createScheduledPost(input: NewScheduledPost): Promise<ScheduledPost> {
  validatePlatforms(input.platforms);
  const scheduledAt = validateScheduleDate(input.scheduledAt);
  const message = readMessage(input.message);
  const page = getAllPages().find((item) => item.id === input.pageId);
  if (!page?.accessToken) throw new Error("Conectá una página de Facebook antes de programar.");
  const videoPath = input.videoPath || null;
  if (videoPath) checkVideo(videoPath, Boolean(input.image));
  const id = `sched_${randomUUID()}`;
  const imagePath = input.image ? saveImage(id, input.image) : null;
  const platforms = Array.isArray(input.platforms) && input.platforms.length > 0 ? (input.platforms as string[]) : ["facebook"];
  const post: ScheduledPost = {
    id,
    pageId: page.id,
    message,
    imagePath,
    videoPath,
    mediaType: videoPath ? "video" : imagePath ? "image" : "text",
    scheduledAt,
    status: "pending",
    createdAt: new Date().toISOString(),
    publishedAt: null,
    postId: null,
    error: null,
    platforms,
  };
  await mutateSchedule((posts) => {
    posts.push(post);
  });
  if (platforms.length === 1 && platforms[0] === "facebook") await scheduleNatively(post, page);
  return post;
}
