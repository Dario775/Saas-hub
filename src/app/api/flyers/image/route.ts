import { readFlyerFile } from "@/lib/flyers/store";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const image = readFlyerFile(request.nextUrl.searchParams.get("id") || "", "imagen");
    if (!image) return NextResponse.json({ error: "El flyer todavía no está listo." }, { status: 404 });
    return new NextResponse(new Uint8Array(image), { headers: { "Content-Type": "image/png" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Flyer inválido." }, { status: 400 });
  }
}
