import Anthropic from "@anthropic-ai/sdk";
import { findClaudeModel } from "./claude-models";

const MAX_OUTPUT_TOKENS = 32_000;
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];
const DEFAULT_EFFORT: Effort = "medium";

export interface ClaudeRequest {
  model: string;
  system: string;
  user: string;
  /** Imagen JPEG para que el modelo la mire. */
  image?: Buffer;
  apiKey?: string;
  expectJson?: boolean;
  timeoutMs?: number;
  /** Razonamiento para esta consulta; si falta, el general (CLAUDE_API_EFFORT). */
  effort?: Effort;
  /** Imagen PNG en lugar de JPEG. */
  imageType?: "image/jpeg" | "image/png";
  /** Inyectable para tests: evita usar la red. */
  fetchImpl?: typeof fetch;
}

/** Nivel de razonamiento. CLAUDE_API_EFFORT permite bajarlo o subirlo sin tocar código. */
export function claudeEffort(value = process.env.CLAUDE_API_EFFORT): Effort {
  return EFFORTS.find((effort) => effort === value) || DEFAULT_EFFORT;
}

/** Traduce los errores del SDK a un mensaje accionable, del más específico al más general. */
function describeError(error: unknown, hasKey: boolean): string {
  if (error instanceof Anthropic.AuthenticationError)
    return "Claude rechazó la credencial (401). Revisá la clave de Claude en la configuración de IA.";
  if (error instanceof Anthropic.PermissionDeniedError)
    return "Tu clave de Claude no tiene permiso para usar este modelo (403).";
  if (error instanceof Anthropic.NotFoundError)
    return "El modelo de Claude configurado no existe o no está disponible para tu cuenta (404).";
  if (error instanceof Anthropic.RateLimitError)
    return "Claude alcanzó el límite de solicitudes (429). Esperá unos segundos y reintentá.";
  if (error instanceof Anthropic.APIConnectionTimeoutError)
    return "Claude tardó demasiado en responder.";
  if (error instanceof Anthropic.APIConnectionError)
    return "No se pudo conectar con la API de Claude. Revisá tu conexión.";
  if (error instanceof Anthropic.APIError) {
    if (error.type === "billing_error" || error.status === 402)
      return "Tu cuenta de Claude no tiene saldo disponible. Cargá crédito en platform.claude.com.";
    if (error.status && error.status >= 500)
      return "La API de Claude no está disponible en este momento. Reintentá en unos minutos.";
    return `Claude rechazó la solicitud (${error.status}): ${error.message.slice(0, 300)}`;
  }
  if (!hasKey)
    return "Falta la clave de Claude: guardala en la configuración de IA del panel o en .env.local como ANTHROPIC_API_KEY.";
  return error instanceof Error ? error.message : "Falló la llamada a Claude.";
}

/** Envía una consulta a la API de Claude con el SDK oficial y devuelve el texto. */
export async function queryClaude(request: ClaudeRequest): Promise<string> {
  const apiKey = request.apiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  const model = findClaudeModel(request.model);

  let message: Anthropic.Beta.BetaMessage;
  try {
    const client = new Anthropic({
      // Sin clave explícita el SDK prueba las otras credenciales del equipo.
      ...(apiKey ? { apiKey } : {}),
      ...(request.fetchImpl ? { fetch: request.fetchImpl } : {}),
    });
    message = await client.beta.messages
      .stream(
        {
          model: request.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: request.expectJson
            ? `${request.system}\nResponde únicamente con un objeto JSON válido, sin texto adicional ni bloques de código.`
            : request.system,
          messages: [
            {
              role: "user",
              content: request.image
                ? [
                    {
                      type: "image",
                      source: { type: "base64", media_type: request.imageType ?? "image/jpeg", data: request.image.toString("base64") },
                    },
                    { type: "text", text: request.user },
                  ]
                : request.user,
            },
          ],
          // Un modelo escrito a mano puede no admitir estas opciones.
          ...(model ? { output_config: { effort: request.effort ?? claudeEffort() } } : {}),
          ...(model?.serverFallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
        },
        request.timeoutMs ? { timeout: request.timeoutMs, signal: AbortSignal.timeout(request.timeoutMs) } : {},
      )
      .finalMessage();
  } catch (error) {
    throw new Error(describeError(error, Boolean(apiKey)), { cause: error });
  }

  if (message.stop_reason === "refusal")
    throw new Error("Claude no respondió esta consulta por sus políticas de uso. Probá reformularla.");
  if (message.stop_reason === "max_tokens")
    throw new Error("La respuesta de Claude quedó cortada por ser demasiado larga.");

  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
  if (!text) throw new Error("Claude devolvió una respuesta vacía.");
  return text;
}
