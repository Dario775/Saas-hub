import { saveEnvironment } from "@/lib/env-store";
import { NextRequest,NextResponse } from "next/server";

function configuration() {
  const configured = Boolean(process.env.GOOGLE_PLACES_KEY?.trim());
  return { success: true, configured, maskedKey: configured ? "••••••••" : "" };
}
export async function GET() { return NextResponse.json(configuration()); }
export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();
    if (typeof apiKey !== "string" || /[\r\n\0]/.test(apiKey)) throw new Error("Clave inválida.");
    await saveEnvironment({ GOOGLE_PLACES_KEY: apiKey.trim() });
    return NextResponse.json(configuration());
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "No se pudo guardar la clave." }, { status: 400 });
  }
}
