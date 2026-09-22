"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cpu,XCircle } from "lucide-react";
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
    openaiApiKey,
    setOpenaiApiKey,
    handleSaveLlmSettings,
  } = controller;
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
                <div className="grid grid-cols-4 gap-1">
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

            <div className="flex items-center gap-3 justify-end pt-4 border-t border-white/[0.06]">
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
