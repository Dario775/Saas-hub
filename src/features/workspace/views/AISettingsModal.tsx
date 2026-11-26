"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLAUDE_MODELS } from "@/lib/claude-models";
import { Cpu,XCircle } from "lucide-react";
import { useState } from "react";
import type { WorkspaceController } from "../hooks/use-workspace";
import { ModalFrame } from "../ModalFrame";
export default function AISettingsModal({
  controller,
}: {
  controller: WorkspaceController;
}) {
  const {
    showLlmModal,
    setShowLlmModal,
    setLlmProvider,
    llmProvider,
    openrouterKey,
    setOpenrouterKey,
    openrouterModel,
    setOpenrouterModel,
    ollamaUrl,
    setOllamaUrl,
    ollamaModel,
    setOllamaModel,
    geminiApiKey,
    setGeminiApiKey,
    geminiModel,
    setGeminiModel,
    deepseekApiKey,
    setDeepseekApiKey,
    deepseekModel,
    setDeepseekModel,
    claudeApiKey,
    setClaudeApiKey,
    claudeModel,
    setClaudeModel,
    claudeEnvKeySet,
    jevApiKey,
    setJevApiKey,
    openaiApiKey,
    setOpenaiApiKey,
    handleSaveLlmSettings,
  } = controller;
  const [probe, setProbe] = useState<{ ok: boolean; text: string } | null>(null);
  const [probing, setProbing] = useState(false);

  /** Prueba la conexión con lo que ya está guardado en el servidor. */
  async function testConnection() {
    setProbing(true);
    setProbe(null);
    try {
      const response = await fetch("/api/ai/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: llmProvider }),
      });
      const data = await response.json();
      setProbe(
        data.success
          ? { ok: true, text: `Conexión correcta: ${data.model} (${data.latencyMs} ms)` }
          : { ok: false, text: data.error || "No se pudo probar la conexión." },
      );
    } catch {
      setProbe({ ok: false, text: "No se pudo probar la conexión." });
    } finally {
      setProbing(false);
    }
  }

  return (
    <>
      {" "}
      {showLlmModal && (
        <ModalFrame
          title="Configuración de IA"
          onClose={() => setShowLlmModal(false)}
        >
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#0d0d15] border border-white/[0.08] shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-400 animate-pulse" />
                <h3 className="text-lg font-bold text-slate-100">
                  Conexión de IA
                </h3>
              </div>
              <button
                aria-label="Cerrar configuración de IA"
                onClick={() => setShowLlmModal(false)}
                className="text-slate-400 hover:text-slate-205 p-1 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Las claves se guardan en este equipo. Dejá los campos de clave
                vacíos para conservar las que ya configuraste.
              </p>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Proveedor de IA
                </Label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setLlmProvider("openrouter")}
                    className={`px-1 py-2 rounded-xl border text-[9px] sm:text-xs font-bold transition-all cursor-pointer ${
                      llmProvider === "openrouter"
                        ? "bg-purple-650/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)] font-bold"
                        : "bg-white/[0.01] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                    }`}
                  >
                    🚀 OpenRouter
                  </button>
                  <button
                    onClick={() => setLlmProvider("ollama")}
                    className={`px-1 py-2 rounded-xl border text-[9px] sm:text-xs font-bold transition-all cursor-pointer ${
                      llmProvider === "ollama"
                        ? "bg-purple-650/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)] font-bold"
                        : "bg-white/[0.01] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                    }`}
                  >
                    🦙 Ollama
                  </button>
                  <button
                    onClick={() => setLlmProvider("gemini")}
                    className={`px-1 py-2 rounded-xl border text-[9px] sm:text-xs font-bold transition-all cursor-pointer ${
                      llmProvider === "gemini"
                        ? "bg-purple-650/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)] font-bold"
                        : "bg-white/[0.01] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                    }`}
                  >
                    ♊ Gemini
                  </button>
                  <button
                    onClick={() => setLlmProvider("deepseek")}
                    className={`px-1 py-2 rounded-xl border text-[9px] sm:text-xs font-bold transition-all cursor-pointer ${
                      llmProvider === "deepseek"
                        ? "bg-purple-650/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)] font-bold"
                        : "bg-white/[0.01] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                    }`}
                  >
                    DeepSeek
                  </button>
                  <button
                    onClick={() => setLlmProvider("claude")}
                    className={`px-1 py-2 rounded-xl border text-[9px] sm:text-xs font-bold transition-all cursor-pointer ${
                      llmProvider === "claude"
                        ? "bg-purple-650/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)] font-bold"
                        : "bg-white/[0.01] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                    }`}
                  >
                    Claude
                  </button>
                  <button
                    onClick={() => setLlmProvider("openai" as any)}
                    className={`px-1 py-2 rounded-xl border text-[9px] sm:text-xs font-bold transition-all cursor-pointer ${
                      llmProvider === ("openai" as any)
                        ? "bg-purple-650/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)] font-bold"
                        : "bg-white/[0.01] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                    }`}
                  >
                    🟢 OpenAI
                  </button>
                </div>
              </div>

              {llmProvider === "openrouter" && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label
                      htmlFor="or-key"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      API Key de OpenRouter
                    </Label>
                    <Input
                      id="or-key"
                      type="password"
                      placeholder="sk-or-..."
                      value={openrouterKey}
                      onChange={(e) => setOpenrouterKey(e.target.value)}
                      className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="or-model"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      Modelo de OpenRouter
                    </Label>
                    <Input
                      id="or-model"
                      type="text"
                      placeholder="google/gemini-2.5-flash:free"
                      value={openrouterModel}
                      onChange={(e) => setOpenrouterModel(e.target.value)}
                      className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
                    />
                  </div>
                </div>
              )}

              {llmProvider === "ollama" && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label
                      htmlFor="ol-url"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      URL del Servidor de Ollama
                    </Label>
                    <Input
                      id="ol-url"
                      type="text"
                      placeholder="http://localhost:11434/v1"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="ol-model"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      Nombre del Modelo Local
                    </Label>
                    <Input
                      id="ol-model"
                      type="text"
                      placeholder="llama3"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
                    />
                  </div>
                </div>
              )}

              {llmProvider === "gemini" && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label
                      htmlFor="gem-key"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      API Key de Google Gemini
                    </Label>
                    <Input
                      id="gem-key"
                      type="password"
                      placeholder="AIzaSy..."
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="gem-model"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      Nombre del Modelo Gemini
                    </Label>
                    <Input
                      id="gem-model"
                      type="text"
                      placeholder="gemini-2.5-flash"
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
                    />
                  </div>
                </div>
              )}

              {llmProvider === "deepseek" && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label
                      htmlFor="ds-key"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      API Key de DeepSeek
                    </Label>
                    <Input
                      id="ds-key"
                      type="password"
                      placeholder="sk-..."
                      value={deepseekApiKey}
                      onChange={(e) => setDeepseekApiKey(e.target.value)}
                      className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="ds-model"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      Modelo de DeepSeek
                    </Label>
                    <Input
                      id="ds-model"
                      type="text"
                      placeholder="deepseek-flash"
                      value={deepseekModel}
                      onChange={(e) => setDeepseekModel(e.target.value)}
                      className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
                    />
                  </div>
                </div>
              )}

              {llmProvider === "claude" && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label
                      htmlFor="cl-key"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      API Key de Claude
                    </Label>
                    <Input
                      id="cl-key"
                      type="password"
                      autoComplete="off"
                      placeholder={claudeEnvKeySet ? "Clave guardada" : "sk-ant-..."}
                      value={claudeApiKey}
                      onChange={(e) => setClaudeApiKey(e.target.value)}
                      className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
                    />
                    <p className="text-[10px] text-slate-500">
                      Se crea en platform.claude.com y se cobra por uso, aparte
                      de una suscripción a Claude.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="cl-model"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      Modelo de Claude
                    </Label>
                    <select
                      id="cl-model"
                      value={claudeModel}
                      onChange={(e) => setClaudeModel(e.target.value)}
                      className="w-full h-10 rounded-xl border border-white/[0.08] bg-[#121220] px-3 text-xs text-slate-100"
                    >
                      {CLAUDE_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label} · {model.price}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500">
                      Precio por millón de tokens (entrada / salida). Con Claude
                      activo, también analiza las oportunidades.
                    </p>
                  </div>
                </div>
              )}

              {llmProvider === ("openai" as any) && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label
                      htmlFor="op-key"
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      API Key de OpenAI
                    </Label>
                    <Input
                      id="op-key"
                      type="password"
                      placeholder="sk-proj-..."
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-white/[0.06] pt-4">
              <Label
                htmlFor="jev-key"
                className="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
              >
                API Key de Jev (motor de decisión)
              </Label>
              <Input
                id="jev-key"
                type="password"
                placeholder="opcional"
                value={jevApiKey}
                onChange={(e) => setJevApiKey(e.target.value)}
                className="bg-white/[0.02] border-white/[0.08] focus:border-purple-550/40 focus:ring-purple-500/30 text-slate-100 placeholder:text-slate-650 rounded-xl text-xs py-5"
              />
              <p className="text-[10px] text-slate-500">
                Se guarda en el servidor y nunca vuelve al navegador. Sin esta
                clave, el análisis de oportunidad sigue funcionando solo con
                DeepSeek o Claude.
              </p>
            </div>

            {probe && (
              <p
                role="status"
                className={`text-xs break-words ${probe.ok ? "text-emerald-300" : "text-amber-300"}`}
              >
                {probe.text}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 justify-end pt-4 border-t border-white/[0.06]">
              <Button
                variant="ghost"
                disabled={probing}
                onClick={() => void testConnection()}
                title="Prueba la configuración ya guardada. Hace una consulta mínima."
                className="hover:bg-white/[0.04] text-slate-300 rounded-xl px-3 text-xs py-4.5 mr-auto"
              >
                {probing ? "Probando…" : "Probar conexión"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowLlmModal(false)}
                className="hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 rounded-xl px-5 text-xs py-4.5"
              >
                Cerrar
              </Button>
              <Button
                onClick={() => {
                  handleSaveLlmSettings(
                    llmProvider,
                    openrouterKey,
                    openrouterModel,
                    ollamaUrl,
                    ollamaModel,
                    geminiApiKey,
                    geminiModel,
                    openaiApiKey,
                    deepseekApiKey,
                    deepseekModel,
                    jevApiKey,
                    claudeApiKey,
                    claudeModel,
                  );
                }}
                className="bg-purple-600 hover:bg-purple-550 text-white rounded-xl px-5 shadow-[0_0_20px_rgba(168,85,247,0.2)] border border-purple-500/20 text-xs py-4.5"
              >
                Guardar conexión
              </Button>
            </div>
          </div>
        </ModalFrame>
      )}{" "}
    </>
  );
}
