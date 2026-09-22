import {
fbDeletePost,
fbSchedulePost,
fbScheduleWindowOk,
fbUploadPhotoUnpublished,
} from "@/lib/facebook-native";
import { resolvePublicMedia } from "@/lib/media-path";
import { getAllPages } from "@/lib/pages-server";
import {
decodeImage,
validatePlatforms,
validateScheduleDate,
} from "@/lib/publish-validation";
import type { ScheduledPost } from "@/lib/schedule-types";
import {
mutateSchedule,
readDB,
runPendingScheduledPosts,
} from "@/lib/scheduler";
import { NextRequest,NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      posts: readDB().sort(
        (a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt),
      ),
    });
  } catch (error) {
    return failure(error, 500);
  }
}
function failure(error: unknown, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo completar la operación.",
    },
    { status },
  );
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === "publish-now") {
      const target = await mutateSchedule((posts) => {
        const post = posts.find((post) => post.id === body.id);
        if (!post) throw new Error("Publicación no encontrada.");
        if (["published", "publishing"].includes(post.status))
          throw new Error("Esta publicación ya se envió o está en proceso.");
        const previous = { ...post };
        post.status = "publishing";
        post.processingAt = new Date().toISOString();
        return previous;
      });
      if (target.fbScheduled && target.postId) {
        try {
          const page = getAllPages().find((page) => page.id === target.pageId);
          if (!page) throw new Error("La página no está configurada.");
          await fbDeletePost(page, target.postId);
        } catch (error) {
          await mutateSchedule((posts) => {
            const post = posts.find((p) => p.id === target.id);
            if (post) Object.assign(post, target);
          });
          throw error;
        }
      }
      await mutateSchedule((posts) => {
        const post = posts.find((p) => p.id === target.id)!;
        post.fbScheduled = false;
        post.status = "pending";
        post.error = null;
        post.scheduledAt = new Date(Date.now() - 1000).toISOString();
      });
      const report = await runPendingScheduledPosts(target.id);
      return NextResponse.json(
        {
          success: report.failed.length === 0,
          posts: readDB(),
          ...report,
          error: report.failed[0]?.error,
        },
        { status: report.failed.length ? 502 : 200 },
      );
    }
    validatePlatforms(body.platforms);
    const scheduledAt = validateScheduleDate(body.scheduledAt);
    if (
      typeof body.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 60_000
    )
      throw new Error("Escribí un mensaje válido para la publicación.");
    const page = getAllPages().find((page) => page.id === body.pageId);
    if (!page?.accessToken)
      throw new Error("Conectá una página de Facebook antes de programar.");
    const videoPath = body.videoUrl || body.videoPath || null;
    if (videoPath) {
      const resolved = resolvePublicMedia(videoPath, [
        "generated-videos",
        "scheduled-videos",
      ]);
      if (!fs.existsSync(resolved))
        throw new Error("No encontramos el video seleccionado.");
      if (body.image)
        throw new Error("Elegí una imagen o un video para esta publicación.");
    }
    const id = `sched_${randomUUID()}`;
    let imagePath: string | null = null;
    if (body.image) {
      const buffer = decodeImage(body.image);
      const folder = path.join(process.cwd(), "public", "scheduled-images");
      fs.mkdirSync(folder, { recursive: true });
      imagePath = `/scheduled-images/${id}.png`;
      fs.writeFileSync(resolvePublicMedia(imagePath), buffer);
    }
    const selectedPlatforms =
      Array.isArray(body.platforms) && body.platforms.length > 0
        ? body.platforms
        : ["facebook"];
    const post: ScheduledPost = {
      id,
      pageId: page.id,
      message: body.message.trim(),
      imagePath,
      videoPath,
      mediaType: videoPath ? "video" : imagePath ? "image" : "text",
      scheduledAt,
      status: "pending",
      createdAt: new Date().toISOString(),
      publishedAt: null,
      postId: null,
      error: null,
      platforms: selectedPlatforms,
    };
    await mutateSchedule((posts) => {
      posts.push(post);
    });
    // Si es exclusivamente Facebook, puede usar la ventana nativa de Facebook
    const isOnlyFacebook =
      selectedPlatforms.length === 1 && selectedPlatforms[0] === "facebook";
    if (
      isOnlyFacebook &&
      imagePath &&
      fbScheduleWindowOk(Date.parse(scheduledAt), Date.now())
    ) {
      let schedulingRequested = false;
      try {
        const mediaId = await fbUploadPhotoUnpublished(
          page,
          resolvePublicMedia(imagePath),
        );
        schedulingRequested = true;
        const nativeId = await fbSchedulePost(
          page,
          post.message,
          mediaId,
          Math.floor(Date.parse(scheduledAt) / 1000),
        );
        post.postId = nativeId;
        post.fbScheduled = true;
        post.status = "scheduled";
      } catch (error) {
        if (schedulingRequested) {
          post.status = "failed";
          post.error = `No pudimos confirmar la programación en Facebook. Revisá Meta antes de reintentar. ${error instanceof Error ? error.message : ""}`;
        }
      }
      await mutateSchedule((posts) => {
        const saved = posts.find((p) => p.id === post.id);
        if (saved) Object.assign(saved, post);
      });
    }
    return NextResponse.json(
      { success: post.status !== "failed", post, error: post.error },
      { status: post.status === "failed" ? 502 : 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) throw new Error("Falta el identificador de la publicación.");
    await mutateSchedule((posts) => {
      const target = posts.find((p) => p.id === id);
      if (!target) throw new Error("Publicación no encontrada.");
      if (target.status === "publishing")
        throw new Error("El envío está en curso. Esperá a que termine.");
    });
    const post = readDB().find((p) => p.id === id)!;
    if (post.fbScheduled && post.postId && post.status === "scheduled") {
      const page = getAllPages().find((page) => page.id === post.pageId);
      if (!page)
        throw new Error(
          "Reconectá la página para cancelar también en Facebook.",
        );
      await fbDeletePost(page, post.postId);
    }
    await mutateSchedule((posts) => {
      const index = posts.findIndex((p) => p.id === id);
      if (index < 0) return;
      if (posts[index].status === "publishing")
        throw new Error("El envío acaba de comenzar. Esperá a que termine.");
      posts.splice(index, 1);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
