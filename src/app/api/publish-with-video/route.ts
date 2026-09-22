import { handlePublish } from "@/lib/publish-handler";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return handlePublish(request, "video");
}
