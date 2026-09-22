import { comfyGenerateVideo,comfyHealth } from "@/lib/comfy-client";
import { buildWanVideoWorkflow,type WanVideoOptions } from "@/lib/video-generators";
import { NextRequest,NextResponse } from "next/server";

export const maxDuration = 300; // Timeout de ejecución permitido

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      negativePrompt,
      aspectRatio = "9:16",
      duration = 5,
      fps = 16,
      lightning = false,
      seed,
    } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Falta el prompt para generar el video" }, { status: 400 });
    }

    // 1. Pre-verificación de ComfyUI
    const isHealthy = await comfyHealth();
    if (!isHealthy) {
      return NextResponse.json(
        {
          error: "ComfyUI no responde",
          detail: "Asegúrate de que ComfyUI esté corriendo en http://127.0.0.1:8188.",
        },
        { status: 503 }
      );
    }

    // 2. Construir el workflow de Wan 2.2 14B T2V
    const options: WanVideoOptions = {
      aspectRatio: aspectRatio as "9:16" | "1:1" | "16:9",
      duration: Number(duration) || 5,
      fps: Number(fps) || 16,
      lightning: Boolean(lightning),
      negativePrompt: negativePrompt ? String(negativePrompt) : undefined,
      seed: seed ? Number(seed) : undefined,
    };

    const workflow = buildWanVideoWorkflow(prompt.trim(), options);

    // 3. Ejecutar en ComfyUI y esperar resultado
    console.log(`[Wan 2.2 T2V] Enviando generación de video... (Lightning: ${options.lightning}, Aspect: ${options.aspectRatio}, Dur: ${options.duration}s)`);
    const result = await comfyGenerateVideo(workflow);

    return NextResponse.json({
      success: true,
      generator: "wan2.2-14b-t2v",
      generator_name: options.lightning ? "Wan 2.2 14B (Lightning 4-Steps)" : "Wan 2.2 14B (Calidad 20-Steps)",
      videoUrl: result.videoUrl,
      videoPath: result.videoPath,
      promptId: result.promptId,
      elapsed: result.elapsed,
      filename: result.filename,
      sizeBytes: result.sizeBytes,
    });
  } catch (err: any) {
    console.error("[Wan 2.2 T2V] Error en generación de video:", err);
    return NextResponse.json(
      {
        error: "Error al generar video con Wan 2.2",
        detail: err.message || String(err),
      },
      { status: 500 }
    );
  }
}
