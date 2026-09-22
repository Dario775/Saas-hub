import { getAllPages } from "@/lib/pages-server";
import { readDB } from "@/lib/scheduler";
import { NextResponse } from "next/server";

// Salud integral: cola, servicios de Facebook y reloj del server.
// Esta consulta es de lectura; el worker se inicia desde instrumentation.
export async function GET() {
  const posts = readDB();
  const now = Date.now();

  const activos = posts.filter((p) => p.status === "pending" || p.status === "scheduled");
  const next =
    activos
      .map((p) => p)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0] ?? null;

  const pages = getAllPages();
  const facebook = await Promise.all(
    pages.map(async (pg) => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${pg.pageId}?fields=name&access_token=${encodeURIComponent(pg.accessToken)}`,
          { signal: ctl.signal }
        );
        clearTimeout(t);
        const j = await r.json();
        return { id: pg.id, pageId: pg.pageId, name: j?.name ?? null, tokenOk: r.ok };
      } catch (e) {
        return { id: pg.id, pageId: pg.pageId, name: null, tokenOk: false, error: String(e) };
      }
    })
  );

  return NextResponse.json({
    success: true,
    server: {
      now: new Date().toISOString(),
      tzOffsetMin: -new Date().getTimezoneOffset(),
      uptimeSec: Math.round(process.uptime()),
    },
    queue: {
      total: posts.length,
      activos: activos.length,
      published: posts.filter((p) => p.status === "published").length,
      failed: posts.filter((p) => p.status === "failed").length,
      next: next
        ? {
            id: next.id,
            pageId: next.pageId,
            scheduledAt: next.scheduledAt,
            status: next.status,
            msLeft: Math.max(0, new Date(next.scheduledAt).getTime() - now),
            fbScheduled: !!next.fbScheduled,
            imagePath: next.imagePath,
          }
        : null,
      lastPublished: posts
        .filter((p) => p.status === "published")
        .slice(-3)
        .map((p) => ({
          id: p.id,
          scheduledAt: p.scheduledAt,
          publishedAt: p.publishedAt,
          postId: p.postId,
          permalink: p.permalink ?? null,
        })),
      lastFailed: posts
        .filter((p) => p.status === "failed")
        .slice(-3)
        .map((p) => ({ id: p.id, scheduledAt: p.scheduledAt, error: p.error })),
    },
    facebook,
  });
}
