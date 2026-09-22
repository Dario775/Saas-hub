import { saveEnvironment } from "@/lib/env-store";
import { NextRequest,NextResponse } from "next/server";
const fields: Record<string, string> = {
  provider: "LLM_PROVIDER",
  openrouterKey: "OPENROUTER_API_KEY",
  openrouterModel: "OPENROUTER_MODEL",
  ollamaUrl: "LOCAL_LLM_URL",
  ollamaModel: "LOCAL_LLM_MODEL",
  geminiApiKey: "GEMINI_API_KEY",
  geminiModel: "GEMINI_MODEL",
  openaiApiKey: "OPENAI_API_KEY",
  deepseekKey: "DEEPSEEK_API_KEY",
  deepseekModel: "DEEPSEEK_MODEL",
};
const secrets = new Set([
  "openrouterKey",
  "geminiApiKey",
  "openaiApiKey",
  "deepseekKey",
]);
export async function GET() {
  const settings: Record<string, string | boolean> = {};
  for (const [key, variable] of Object.entries(fields))
    settings[secrets.has(key) ? `${key}Configured` : key] = secrets.has(key)
      ? Boolean(process.env[variable])
      : process.env[variable] || "";
  return NextResponse.json({ success: true, settings });
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (
      body.provider &&
      !["openrouter", "ollama", "gemini", "openai", "deepseek"].includes(
        body.provider,
      )
    )
      throw new Error("Proveedor de IA inválido.");
    const changes: Record<string, string> = {};
    for (const [key, variable] of Object.entries(fields)) {
      const value = body[key];
      if (value === undefined || value === "") continue;
      if (typeof value !== "string") throw new Error("Configuración inválida.");
      if (body.migrate && secrets.has(key) && process.env[variable]) continue;
      changes[variable] = value;
    }
    await saveEnvironment(changes);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la configuración.",
      },
      { status: 400 },
    );
  }
}
