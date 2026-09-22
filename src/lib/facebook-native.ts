// Programación nativa en Facebook (Graph API v21).
// En lugar de depender del worker local, Facebook guarda la publicación
// y la suelta solo a la hora indicada (ventana: +10 min a +75 días).
import fs from "fs";
import type { ServerFacebookPage as FacebookPage } from "./pages-server";

const GRAPH = "https://graph.facebook.com/v21.0";

async function fbJson(resp: Response, ctx: string): Promise<any> {
  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`${ctx}: ${JSON.stringify(j)}`);
  return j;
}

// 1) Sube la foto SIN publicarla; devuelve el id usable como media_fbid.
export async function fbUploadPhotoUnpublished(page: FacebookPage, imageAbsPath: string): Promise<string> {
  const buf = fs.readFileSync(imageAbsPath);
  const form = new FormData();
  form.append("source", new Blob([buf], { type: "image/png" }), "photo.png");
  form.append("published", "false");
  form.append("access_token", page.accessToken);
  const resp = await fetch(`${GRAPH}/${page.pageId}/photos`, { method: "POST", body: form });
  const j = await fbJson(resp, "FB upload photo");
  if (!j.id) throw new Error(`FB upload photo: respuesta sin id: ${JSON.stringify(j)}`);
  return String(j.id);
}

// 2) Crea el post programado en el muro de la página.
export async function fbSchedulePost(
  page: FacebookPage,
  message: string,
  mediaFbid: string | null,
  unixTimeSec: number
): Promise<string> {
  const params = new URLSearchParams();
  params.set("message", message);
  params.set("published", "false");
  params.set("scheduled_publish_time", String(unixTimeSec));
  params.set("access_token", page.accessToken);
  if (mediaFbid) params.set("attached_media", JSON.stringify([{ media_fbid: mediaFbid }]));
  const resp = await fetch(`${GRAPH}/${page.pageId}/feed`, { method: "POST", body: params });
  const j = await fbJson(resp, "FB schedule feed");
  if (!j.id) throw new Error(`FB schedule feed: respuesta sin id: ${JSON.stringify(j)}`);
  return String(j.id);
}

// 3) Elimina un post programado/público en Facebook.
export async function fbDeletePost(page: FacebookPage, postId: string): Promise<void> {
  const resp = await fetch(`${GRAPH}/${postId}?access_token=${encodeURIComponent(page.accessToken)}`, { method: "DELETE" });
  await fbJson(resp, "FB delete post");
}

// 4) Link permanente del post (para reportar evidencia).
export async function fbPermalink(page: FacebookPage, postId: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `${GRAPH}/${postId}?fields=permalink_url&access_token=${encodeURIComponent(page.accessToken)}`,
      { method: "GET" }
    );
    if (!resp.ok) return null;
    const j = await resp.json();
    return typeof j?.permalink_url === "string" ? j.permalink_url : null;
  } catch {
    return null;
  }
}

// Ventana que acepta Facebook para publicaciones programadas.
export function fbScheduleWindowOk(scheduledAtMs: number, nowMs: number): boolean {
  const MIN = 10 * 60 * 1000; // +10 min
  const MAX = 75 * 24 * 3600 * 1000; // +75 días
  const delta = scheduledAtMs - nowMs;
  return delta >= MIN && delta <= MAX;
}
