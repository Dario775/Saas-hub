export interface PlatformResult {
  status: "published" | "failed" | "skipped";
  postId?: string | null;
  permalink?: string | null;
  error?: string | null;
  publishedAt?: string | null;
}

export interface ScheduledPost {
  id: string;
  pageId: string;
  message: string;
  imagePath: string | null;
  videoPath?: string | null;
  mediaType?: "image" | "video" | "text";
  scheduledAt: string;
  status: "pending" | "scheduled" | "publishing" | "published" | "failed";
  createdAt: string;
  publishedAt: string | null;
  postId: string | null;
  error: string | null;
  fbScheduled?: boolean;
  permalink?: string | null;
  platforms?: string[];
  platformResults?: Record<string, PlatformResult>;
  processingAt?: string;
}

