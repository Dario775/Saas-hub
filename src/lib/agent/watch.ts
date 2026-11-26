import type { ScheduledPost } from "../schedule-types";
import type { Notifier } from "./campaign";
import { formatSlot } from "./slots";
import { readCampaigns, updateCampaign, type CampaignPiece } from "./store";

type Outcome = NonNullable<CampaignPiece["notified"]>;

function outcomeOf(post: ScheduledPost | undefined): Outcome | null {
  if (post?.status === "published") return "published";
  if (post?.status === "failed") return "failed";
  return null;
}

function describe(piece: CampaignPiece, post: ScheduledPost, outcome: Outcome): string {
  const when = formatSlot(new Date(post.scheduledAt));
  const kind = piece.media === "video" ? "El video" : "La publicación";
  if (outcome === "failed") return `${kind} de ${when} no se pudo publicar: ${post.error || "error sin detalle"}.`;
  return `${kind} de ${when} ya salió en Facebook.${post.permalink ? `\n${post.permalink}` : ""}`;
}

/** Avisa una sola vez cuando cada pieza programada sale o falla. */
export async function notifyOutcomes(posts: ScheduledPost[], notify: Notifier): Promise<number> {
  const byId = new Map(posts.map((post) => [post.id, post]));
  let sent = 0;
  for (const campaign of readCampaigns().filter((item) => item.status === "scheduled")) {
    const updates = new Map<string, Outcome>();
    for (const piece of campaign.pieces) {
      const post = piece.postId ? byId.get(piece.postId) : undefined;
      const outcome = outcomeOf(post);
      if (!post || !outcome || piece.notified === outcome) continue;
      await notify.text(campaign.chatId, describe(piece, post, outcome));
      updates.set(piece.postId!, outcome);
      sent++;
    }
    if (!updates.size) continue;
    await updateCampaign(campaign.id, (current) => ({
      ...current,
      pieces: current.pieces.map((piece) =>
        piece.postId && updates.has(piece.postId) ? { ...piece, notified: updates.get(piece.postId) } : piece,
      ),
    }));
  }
  return sent;
}

/** Lo que sale en los próximos días, para responder "¿qué hay programado?". */
export function upcomingSummary(posts: ScheduledPost[], pageNames: Map<string, string>, now = new Date(), days = 7): string {
  const until = now.getTime() + days * 86_400_000;
  const upcoming = posts
    .filter((post) => ["pending", "scheduled"].includes(post.status))
    .filter((post) => {
      const at = Date.parse(post.scheduledAt);
      return at >= now.getTime() && at <= until;
    })
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  if (!upcoming.length) return `No hay nada programado para los próximos ${days} días.`;
  const lines = upcoming.slice(0, 30).map((post) => {
    const kind = post.mediaType === "video" ? "video" : post.mediaType === "image" ? "imagen" : "texto";
    return `• ${formatSlot(new Date(post.scheduledAt))} — ${pageNames.get(post.pageId) || post.pageId} (${kind})`;
  });
  const more = upcoming.length > 30 ? `\n…y ${upcoming.length - 30} más.` : "";
  return `Programado para los próximos ${days} días:\n${lines.join("\n")}${more}`;
}
