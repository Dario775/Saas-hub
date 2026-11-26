import { buildBackgroundRemovalWorkflow, removalResolution } from "@/lib/background-removal";
import { comfyGenerate, comfyHealth, comfyUpload } from "@/lib/comfy-client";
import { decodeImage } from "@/lib/publish-validation";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Quita el fondo con Qwen Image 2.1 local. Devuelve un PNG con canal alfa. */
export async function POST(request: NextRequest) {
  let buffer: Buffer;
  let resolution: number;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    buffer = decodeImage(body.image);
    resolution = removalResolution(body.width, body.height);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Imagen inválida." },
      { status: 400 },
    );
  }

  if (!(await comfyHealth()))
    return NextResponse.json(
      { success: false, error: "ComfyUI está apagado. Encendelo desde el panel para recortar con IA." },
      { status: 503 },
    );

  try {
    const name = await comfyUpload(buffer);
    const result = await comfyGenerate(
      buildBackgroundRemovalWorkflow(name, resolution),
      "qwen-image-2.1",
    );
    return NextResponse.json({ success: true, image: result.image, elapsed: result.elapsed });
  } catch (error) {
    console.error("[Recorte]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo quitar el fondo.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
