"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import {
  Cloud,
  Copy,
  Cpu,
  Download,
  Layers,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import type { WorkspaceController } from "../hooks/use-workspace";
export default function CreativeView({
  controller,
}: {
  controller: WorkspaceController;
}) {
  const {
    tab,
    brands,
    pageId,
    creativeTopic,
    setCreativeTopic,
    creativeLoading,
    handleGenerateConcepts,
    creativeLanguage,
    setCreativeLanguage,
    creativePlatform,
    setCreativePlatform,
    creativeAspect,
    setCreativeAspect,
    creativeUpscale,
    setCreativeUpscale,
    creativeProgress,
    creativeConcepts,
    handleRenderSingleConcept,
    renderingConceptIdx,
    renderingConceptEngine,
    handleCopyConceptCopy,
    setComposerInitialImage,
    setTab,
    handleConceptToPublish,
  } = controller;
  return (
    <>
      {" "}
      {tab === "creative" && (
        <div className="animate-fadeIn space-y-6 pb-20">
          {/* Input de campaña */}
          <div className="premium-glass-card rounded-2xl p-6 space-y-4 relative overflow-hidden bg-amber-500/5 border-amber-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[40px] pointer-events-none" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/10 pb-3">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> ¿Qué querés comunicar?
              </h3>
              {brands.find((b) => b.id === pageId) && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-[11px] text-amber-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    Kit de Marca:{" "}
                    <b>{brands.find((b) => b.id === pageId)?.name}</b>
                  </span>
                  {brands.find((b) => b.id === pageId)?.colors
                    ?.primary?.[0] && (
                    <div className="flex items-center gap-1 ml-1">
                      {brands
                        .find((b) => b.id === pageId)
                        ?.colors.primary.slice(0, 2)
                        .map((c, i) => (
                          <span
                            key={i}
                            className="w-2.5 h-2.5 rounded-full border border-white/20"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Explorá{" "}
              <b className="text-slate-200">5 propuestas de contenido</b> con el
              tono y los colores de tu marca. Elegí tu favorita, ajustá el
              diseño y prepará la publicación.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1.5 col-span-1 sm:span-2 lg:col-span-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Tema de la campaña
                </Label>
                <Input
                  value={creativeTopic}
                  onChange={(e) => setCreativeTopic(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    !creativeLoading &&
                    handleGenerateConcepts()
                  }
                  placeholder="Ej: Lanzamiento de producto, oferta..."
                  className="bg-white/[0.02] border-white/[0.05] text-slate-200 text-xs rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Idioma del Copy
                </Label>
                <Select
                  value={creativeLanguage}
                  onValueChange={(v: string | null) =>
                    v && setCreativeLanguage(v as "es" | "en")
                  }
                >
                  <SelectTrigger className="bg-white/[0.02] border-white/[0.05] h-10 text-xs rounded-xl px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-xs max-h-60">
                    <SelectItem value="es">🇪🇸 Español (Por defecto)</SelectItem>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Plataforma
                </Label>
                <Select
                  value={creativePlatform}
                  onValueChange={(v: string | null) =>
                    v && setCreativePlatform(v)
                  }
                >
                  <SelectTrigger className="bg-white/[0.02] border-white/[0.05] h-10 text-xs rounded-xl px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-xs max-h-60">
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="flyer">Flyer / Impresión</SelectItem>
                    <SelectItem value="story">Historia (Story)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Aspect Ratio
                </Label>
                <Select
                  value={creativeAspect}
                  onValueChange={(v: string | null) =>
                    v && setCreativeAspect(v)
                  }
                >
                  <SelectTrigger className="bg-white/[0.02] border-white/[0.05] h-10 text-xs rounded-xl px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-xs max-h-60">
                    <SelectItem value="1:1">1:1 — Post Cuadrado</SelectItem>
                    <SelectItem value="4:5">4:5 — Vertical Feed</SelectItem>
                    <SelectItem value="9:16">9:16 — Story / Reels</SelectItem>
                    <SelectItem value="16:9">16:9 — Horizontal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Upscale final
                </Label>
                <Select
                  value={creativeUpscale}
                  onValueChange={(v: string | null) =>
                    v && setCreativeUpscale(v)
                  }
                >
                  <SelectTrigger className="bg-white/[0.02] border-white/[0.05] h-10 text-xs rounded-xl px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-xs max-h-60">
                    <SelectItem value="ultrasharp">
                      4x UltraSharp (detalle)
                    </SelectItem>
                    <SelectItem value="realesrgan">
                      4x RealESRGAN (fotorrealista)
                    </SelectItem>
                    <SelectItem value="ninguno">Sin upscale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleGenerateConcepts}
              disabled={creativeLoading || !creativeTopic.trim()}
              className="w-full sm:w-auto h-11 px-8 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-lg shadow-amber-500/20 transition-all duration-300"
            >
              {creativeLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generando 5
                  conceptos...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Generar 5 Conceptos
                </>
              )}
            </Button>
            {creativeLoading && creativeProgress && (
              <div className="text-[11px] text-amber-300/80 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                {creativeProgress}
                <span className="text-slate-500">
                  (generando 5 propuestas estratégicas en segundos...)
                </span>
              </div>
            )}
          </div>

          {/* Resultados */}
          {creativeConcepts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {creativeConcepts.map((concept: any, idx: number) => (
                <div
                  key={concept.strategyId || idx}
                  className="premium-glass-card rounded-2xl overflow-hidden flex flex-col border-white/[0.05]"
                >
                  <div className="relative aspect-[4/5] bg-black/40 overflow-hidden flex flex-col justify-center p-4">
                    {concept.image ? (
                      <img
                        src={concept.image}
                        alt={concept.conceptName}
                        className="w-full h-full object-cover absolute inset-0"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center space-y-2 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-200">
                          Dirección Visual (Llama 3)
                        </span>
                        <p className="text-[10px] text-slate-400 line-clamp-4 italic px-2 bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                          &quot;{concept.visualPrompt}&quot;
                        </p>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap z-20">
                      <Badge className="bg-black/60 backdrop-blur border-white/10 text-[9px] px-2 py-0.5 text-amber-300">
                        {concept.generatorName || "Z-Image-Turbo"}
                      </Badge>
                      {concept.image && (
                        <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-300 text-[9px] px-2 py-0.5">
                          upscale 4x
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-2 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-[13px] font-bold text-slate-100">
                          {concept.conceptName}
                        </h4>
                        <p className="text-[10px] text-amber-400/80 mt-0.5">
                          {concept.generatorReason}
                        </p>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-300 leading-snug">
                      <b className="text-slate-100">{concept.headline}</b>
                      {concept.subtitle ? (
                        <span> — {concept.subtitle}</span>
                      ) : null}
                      {concept.cta ? (
                        <span className="text-amber-300 font-bold">
                          {" "}
                          · {concept.cta}
                        </span>
                      ) : null}
                    </div>
                    {concept.caption && (
                      <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3">
                        {concept.caption}
                      </p>
                    )}
                    {!concept.image && (
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        <button
                          onClick={() =>
                            handleRenderSingleConcept(concept, idx, "comfyui")
                          }
                          disabled={renderingConceptIdx === idx}
                          className="h-8 text-[10px] font-bold rounded-xl bg-gradient-to-r from-amber-600/25 to-orange-600/25 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 transition-all duration-300 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Renderizar localmente con ComfyUI y upscale 4x"
                        >
                          {renderingConceptIdx === idx &&
                          renderingConceptEngine === "comfyui" ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              <span>En GPU...</span>
                            </>
                          ) : (
                            <>
                              <Cpu className="w-3.5 h-3.5 text-amber-400" />
                              <span>ComfyUI</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() =>
                            handleRenderSingleConcept(concept, idx, "gemini")
                          }
                          disabled={renderingConceptIdx === idx}
                          className="h-8 text-[10px] font-bold rounded-xl bg-gradient-to-r from-sky-600/25 to-indigo-600/25 border border-sky-500/30 hover:bg-sky-500/20 text-sky-300 transition-all duration-300 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Generar al instante con Google Gemini Imagen en la nube"
                        >
                          {renderingConceptIdx === idx &&
                          renderingConceptEngine === "gemini" ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                              <span>Generando...</span>
                            </>
                          ) : (
                            <>
                              <Cloud className="w-3.5 h-3.5 text-sky-400" />
                              <span>Gemini Nube</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2 mt-auto pt-2">
                      {concept.image && (
                        <a
                          href={concept.image}
                          download={`${concept.strategyId || "concepto"}.png`}
                          className="flex-1 h-9 text-center text-[10px] font-semibold rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] text-slate-200 transition-all duration-300 flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Descargar
                        </a>
                      )}
                      <button
                        onClick={() => handleCopyConceptCopy(concept)}
                        className="h-9 px-2.5 text-[10px] font-semibold rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="Copiar titular, subtítulo y copy al portapapeles"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-400" /> Copiar
                      </button>
                      <button
                        onClick={() => {
                          setComposerInitialImage(concept.image);
                          setTab("composer");
                        }}
                        className="h-9 px-2.5 text-[10px] font-semibold rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="Abrir en Compositor de Capas"
                      >
                        <Layers className="w-3.5 h-3.5" /> Capas
                      </button>
                      <button
                        onClick={() => handleConceptToPublish(concept)}
                        className="flex-1 h-9 text-[10px] font-semibold rounded-xl bg-gradient-to-r from-blue-600/25 to-cyan-600/25 border border-blue-500/35 hover:border-blue-400/50 text-blue-300 transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />{" "}
                        {concept.image ? "Publicar" : "Publicar Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}{" "}
    </>
  );
}
