import "server-only";
import fs from "node:fs";
import { resolvePublicMedia } from "./media-path";
import type { ServerFacebookPage } from "./pages-server";

export async function publishInstagram(
  page: ServerFacebookPage,
  post: {
    message: string;
    image?: Buffer;
    imagePath?: string | null;
    videoPath?: string | null;
  },
): Promise<{ id: string; permalink: string }> {
  if (!page.accessToken) {
    throw new Error("Esta página no tiene credenciales de Meta/Facebook configuradas.");
  }

  const igAccountId = page.instagramAccountId;
  if (!igAccountId) {
    throw new Error(
      `La página "${page.name}" no tiene una cuenta de Instagram Business o Creator vinculada. Vinculala en Meta Business Suite para publicar en Instagram.`,
    );
  }

  const publicAppUrl = process.env.PUBLIC_APP_URL?.replace(/\/+$/, "");
  const isVideo = Boolean(post.videoPath);
  const isImage = Boolean(post.image || post.imagePath);

  if (!isVideo && !isImage) {
    throw new Error("Instagram requiere una imagen o un video para publicar (no admite posts de solo texto).");
  }

  let mediaUrl = "";
  if (isVideo) {
    const rawPath = post.videoPath!;
    if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
      mediaUrl = rawPath;
    } else {
      if (!publicAppUrl) {
        throw new Error(
          "Para publicar videos en Instagram, Meta requiere una URL pública. Configurá PUBLIC_APP_URL en .env.local (por ejemplo tu túnel o dominio público).",
        );
      }
      mediaUrl = `${publicAppUrl}${rawPath.startsWith("/") ? "" : "/"}${rawPath}`;
    }
  } else if (isImage) {
    if (post.imagePath?.startsWith("http://") || post.imagePath?.startsWith("https://")) {
      mediaUrl = post.imagePath;
    } else if (post.imagePath) {
      if (!publicAppUrl) {
        throw new Error(
          "Para publicar imágenes en Instagram, Meta requiere una URL pública accesible. Configurá PUBLIC_APP_URL en .env.local (por ejemplo tu túnel o dominio público).",
        );
      }
      mediaUrl = `${publicAppUrl}${post.imagePath.startsWith("/") ? "" : "/"}${post.imagePath}`;
    } else if (post.image) {
      // Guardar imagen temporal si vino como Buffer
      const tempId = `ig_temp_${Date.now()}`;
      const tempFolder = resolvePublicMedia("/scheduled-images");
      fs.mkdirSync(tempFolder, { recursive: true });
      const tempRel = `/scheduled-images/${tempId}.png`;
      fs.writeFileSync(resolvePublicMedia(tempRel), post.image);
      if (!publicAppUrl) {
        throw new Error(
          "Para publicar en Instagram, Meta requiere una URL pública accesible. Configurá PUBLIC_APP_URL en .env.local.",
        );
      }
      mediaUrl = `${publicAppUrl}${tempRel}`;
    }
  }

  // 1. Crear el contenedor de medios en Instagram
  const containerParams: Record<string, string> = {
    access_token: page.accessToken,
    caption: post.message,
  };

  if (isVideo) {
    containerParams.media_type = "REELS";
    containerParams.video_url = mediaUrl;
  } else {
    containerParams.image_url = mediaUrl;
  }

  const createRes = await fetch(
    `https://graph.facebook.com/v21.0/${igAccountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerParams),
      signal: AbortSignal.timeout(30_000),
    },
  );

  const createData = await createRes.json();
  if (!createRes.ok || !createData.id) {
    const msg = createData?.error?.message || "Meta rechazó la creación del post en Instagram.";
    throw new Error(`[Instagram] ${msg}`);
  }

  const creationId = createData.id;

  // 2. Si es video, esperar a que el procesamiento de Reels termine
  if (isVideo) {
    let finished = false;
    for (let attempt = 0; attempt < 25; attempt++) {
      await new Promise((r) => setTimeout(r, 4000));
      const statusRes = await fetch(
        `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(page.accessToken)}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      const statusData = await statusRes.json();
      if (statusData.status_code === "FINISHED") {
        finished = true;
        break;
      }
      if (statusData.status_code === "ERROR") {
        throw new Error(
          `[Instagram] Error al procesar el video: ${statusData.status || "Código de error de Meta"}`,
        );
      }
    }
    if (!finished) {
      throw new Error("[Instagram] El video tardó demasiado en ser procesado por Instagram.");
    }
  }

  // 3. Publicar el contenedor
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igAccountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: page.accessToken,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) {
    const msg = publishData?.error?.message || "Instagram no confirmó la publicación.";
    throw new Error(`[Instagram] ${msg}`);
  }

  const publishedId = String(publishData.id);
  return {
    id: publishedId,
    permalink: `https://www.instagram.com/p/${publishedId}`,
  };
}
