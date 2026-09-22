import "server-only";
import { publishFacebook } from "./facebook-publisher";
import { publishInstagram } from "./instagram-publisher";
import { publishLinkedIn } from "./linkedin-publisher";
import { publishX } from "./x-publisher";
import type { ServerFacebookPage } from "./pages-server";
import type { PlatformResult } from "./schedule-types";

export interface SocialDispatchResult {
  hasSuccess: boolean;
  allSucceeded: boolean;
  primaryId: string | null;
  primaryPermalink: string | null;
  platformResults: Record<string, PlatformResult>;
  errors: string[];
}

export async function dispatchToSocialNetworks(
  page: ServerFacebookPage,
  post: {
    message: string;
    image?: Buffer;
    imagePath?: string | null;
    videoPath?: string | null;
  },
  platforms: string[] = ["facebook"],
): Promise<SocialDispatchResult> {
  const selected = platforms.length > 0 ? platforms : ["facebook"];
  const platformResults: Record<string, PlatformResult> = {};
  const errors: string[] = [];

  for (const platform of selected) {
    try {
      let res: { id: string; permalink: string };
      switch (platform.toLowerCase()) {
        case "facebook":
          res = await publishFacebook(page, post);
          break;
        case "instagram":
          res = await publishInstagram(page, post);
          break;
        case "linkedin":
          res = await publishLinkedIn(page, post);
          break;
        case "x":
        case "twitter":
          res = await publishX(page, post);
          break;
        default:
          throw new Error(`Plataforma no soportada: "${platform}"`);
      }

      platformResults[platform] = {
        status: "published",
        postId: res.id,
        permalink: res.permalink,
        publishedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`${platform}: ${errMsg}`);
      platformResults[platform] = {
        status: "failed",
        error: errMsg,
      };
    }
  }

  const successes = Object.entries(platformResults).filter(
    ([, val]) => val.status === "published",
  );
  const hasSuccess = successes.length > 0;
  const allSucceeded = errors.length === 0;

  // Elegir el ID principal (preferir Facebook, o el primero que haya tenido éxito)
  const fbResult = platformResults["facebook"];
  const firstSuccess = successes[0]?.[1];
  const primaryId =
    fbResult?.status === "published"
      ? fbResult.postId || null
      : firstSuccess?.postId || null;
  const primaryPermalink =
    fbResult?.status === "published"
      ? fbResult.permalink || null
      : firstSuccess?.permalink || null;

  return {
    hasSuccess,
    allSucceeded,
    primaryId,
    primaryPermalink,
    platformResults,
    errors,
  };
}
