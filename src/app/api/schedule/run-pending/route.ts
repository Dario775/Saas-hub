import { runPendingScheduledPosts } from "@/lib/scheduler";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const report = await runPendingScheduledPosts();
    return NextResponse.json({ success: true, ...report });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to run pending posts", detail: err.message },
      { status: 500 },
    );
  }
}
