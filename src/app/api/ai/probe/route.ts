import { LLM_DEFAULTS, queryLLM, resolveLLMConfig } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PING_SYSTEM =
  "Eres un verificador de conexión. Responde solo con la palabra listo.";
const PING_USER = "Responde solo con la palabra listo.";

/**
 * Prueba de conexión con el proveedor de IA activo.
 * No recibe ni devuelve claves: usa las que ya están guardadas en el servidor.
 */
export async function POST(request: NextRequest) {
  let requested: LLMProvider | undefined;
  try {
    const body = await request.json();
    if (typeof body?.provider === "string") requested = body.provider as LLMProvider;
  } catch {
    requested = undefined;
  }

  const settings = requested ? { provider: requested } : undefined;
  const { provider, model } = resolveLLMConfig(settings);
  const started = Date.now();

  try {
    const text = await queryLLM(PING_SYSTEM, PING_USER, settings, false);
    return NextResponse.json({
      success: true,
      provider,
      model,
      endpoint: LLM_DEFAULTS[provider].url,
      latencyMs: Date.now() - started,
      sample: text.trim().slice(0, 120),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        provider,
        model,
        latencyMs: Date.now() - started,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo probar la conexión con el proveedor de IA.",
      },
      { status: 502 },
    );
  }
}
