import fs from "node:fs";
import "server-only";
import { resolvePublicMedia } from "./media-path";
import type { ServerFacebookPage } from "./pages-server";

export async function publishFacebook(
  page: ServerFacebookPage,
  post: {
    message: string;
    image?: Buffer;
    imagePath?: string | null;
    videoPath?: string | null;
  },
) {
  if (!page.accessToken)
    throw new Error(
      "Esta página no tiene credenciales de Facebook configuradas.",
    );
  const endpoint = post.videoPath
    ? "videos"
    : post.image || post.imagePath
      ? "photos"
      : "feed";
  const form = new FormData();
  form.set("access_token", page.accessToken);
  form.set(endpoint === "videos" ? "description" : "message", post.message);
  if (post.videoPath || post.imagePath || post.image) {
    const buffer =
      post.image ||
      fs.readFileSync(resolvePublicMedia(post.videoPath || post.imagePath!));
    if (buffer.length > 250 * 1024 * 1024)
      throw new Error("El archivo supera el límite de 250 MB.");
    form.set(
      "source",
      new Blob([new Uint8Array(buffer)], {
        type: endpoint === "videos" ? "video/mp4" : "image/png",
      }),
      endpoint === "videos" ? "video.mp4" : "image.png",
    );
  }
  // Never retry a publication automatically: a timeout may follow a successful upload.
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${page.pageId}/${endpoint}`,
    {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(endpoint === "videos" ? 180_000 : 60_000),
    },
  );
  const data = await response.json();
  if (!response.ok || !(data.post_id || data.id))
    throw new Error(
      data.error?.message || "Facebook no confirmó la publicación.",
    );
  const id = String(data.post_id || data.id);
  return { id, permalink: `https://www.facebook.com/${id}` };
}
