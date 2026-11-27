import { fbDeletePost } from "@/lib/facebook-native";
import { getAllPages } from "@/lib/pages-server";
import { decodeImage } from "@/lib/publish-validation";
import { readSource } from "@/lib/flyers/publications";
import { createScheduledPost } from "@/lib/schedule-service";
import {
mutateSchedule,
readDB,
runPendingScheduledPosts,
} from "@/lib/scheduler";
import { NextRequest,NextResponse } from "next/server";

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
    const post = await createScheduledPost({
      pageId: body.pageId,
      message: body.message,
      scheduledAt: body.scheduledAt,
      image: body.image ? decodeImage(body.image) : null,
      videoPath: body.videoUrl || body.videoPath || null,
      platforms: body.platforms,
      source: readSource(body.source),
    });
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
