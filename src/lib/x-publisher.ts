import "server-only";
import type { ServerFacebookPage } from "./pages-server";

export async function publishX(
  page: ServerFacebookPage,
  post: {
    message: string;
    image?: Buffer;
    imagePath?: string | null;
    videoPath?: string | null;
  },
): Promise<{ id: string; permalink: string }> {
  const token =
    process.env[`X_TOKEN_${page.id.toUpperCase()}`] ||
    process.env.X_ACCESS_TOKEN ||
    process.env.TWITTER_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      `X (Twitter) no está configurado para ${page.name}. Definí X_ACCESS_TOKEN en .env.local.`,
    );
  }

  const payload = {
    text: post.message,
  };

  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.data?.id) {
    throw new Error(
      `[X/Twitter] ${data?.detail || data?.title || "Error al publicar en X."}`,
    );
  }

  const tweetId = String(data.data.id);
  return {
    id: tweetId,
    permalink: `https://x.com/i/status/${tweetId}`,
  };
}
