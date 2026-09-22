import "server-only";
import type { ServerFacebookPage } from "./pages-server";

export async function publishLinkedIn(
  page: ServerFacebookPage,
  post: {
    message: string;
    image?: Buffer;
    imagePath?: string | null;
    videoPath?: string | null;
  },
): Promise<{ id: string; permalink: string }> {
  const token =
    process.env[`LINKEDIN_TOKEN_${page.id.toUpperCase()}`] ||
    process.env.LINKEDIN_ACCESS_TOKEN;
  const orgId =
    process.env[`LINKEDIN_ORG_${page.id.toUpperCase()}`] ||
    process.env.LINKEDIN_ORGANIZATION_ID;

  if (!token) {
    throw new Error(
      `LinkedIn no está configurado para ${page.name}. Definí LINKEDIN_TOKEN_${page.id.toUpperCase()} o LINKEDIN_ACCESS_TOKEN en .env.local.`,
    );
  }

  const author = orgId ? `urn:li:organization:${orgId}` : "urn:li:person:me";

  const payload: Record<string, unknown> = {
    author,
    commentary: post.message,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
  };

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202401",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `[LinkedIn] ${errorData.message || response.statusText || "Error al publicar en LinkedIn."}`,
    );
  }

  const postId = response.headers.get("x-restli-id") || `li_${Date.now()}`;
  return {
    id: postId,
    permalink: `https://www.linkedin.com/feed/update/${postId}`,
  };
}
