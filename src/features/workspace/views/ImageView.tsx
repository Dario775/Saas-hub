"use client";
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
import { Textarea } from "@/components/ui/textarea";
import {
GENERATORS,
IMAGE_STYLES,
type ImageGenerator,
} from "@/lib/generators";
import {
Cpu,
Download,
ExternalLink,
Image as ImageIcon,
Layers,
Loader2,
Plus,
Send,
Sparkles,
Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceController } from "../hooks/use-workspace";
export default function ImageView({
  controller,
}: {
  controller: WorkspaceController;
}) {
  const {
    tab,
    imageSource,
    openaiApiKey,
    openaiEnvKeySet,
    geminiApiKey,
    geminiEnvKeySet,
    serviceToggling,
    comfyuiActive,
    canvaServerActive,
    setImageSource,
    handleToggleService,
    setVideoPrompt,
    videoPrompt,
    setVideoAspectRatio,
    videoAspectRatio,
    setVideoDuration,
    videoDuration,
    setVideoLightning,
    videoLightning,
    videoNegativePrompt,
    setVideoNegativePrompt,
    handleGenerateVideo,
    videoLoading,
    generatedVideo,
    videoElapsed,
    setGeneratedVideo,
    message,
    setMessage,
    setTab,
    selectedGenerator,
    quickIdea,
    setQuickIdea,
    handleExpandQuickIdea,
    expandingIdea,
    setSelectedGenerator,
    setGenParams,
    getInitialParams,
    setGeneratedImage,
    aspectRatioPreset,
    setAspectRatioPreset,
    genParams,
    imageSubject,
    setImageSubject,
    imageLoading,
    handleGenerateImage,
    imageText,
    setImageText,
    imageSubtitle,
    setImageSubtitle,
    imageBullets,
    setImageBullets,
    imageStyle,
    setImageStyle,
    dailyVariation,
    setDailyVariation,
    textLayout,
    setTextLayout,
    textStylePreset,
    setTextStylePreset,
    imageDetails,
    setImageDetails,
    imageNegative,
    setImageNegative,
    generatedImage,
    setShowImageLightbox,
    selectedLogo,
    setSelectedLogo,
    brands,
    logoPosition,
    setLogoPosition,
    handleApplyBrandLogo,
    applyingBrand,
    setComposerInitialImage,
    canvaConnected,
    checkCanvaStatus,
    canvaSearchQuery,
    setCanvaSearchQuery,
    fetchCanvaDesigns,
    canvaLoading,
    handleCreateCanvaDesign,
    creatingCanva,
    templateDesignIdForCreation,
    templateDesignTitleForCreation,
    setTemplateDesignIdForCreation,
    setTemplateDesignTitleForCreation,
    creationPrompt,
    setCreationPrompt,
    creatingFromTemplate,
    handleCreateFlyerFromTemplate,
    canvaDesigns,
    loading,
    handleImportCanvaDesign,
    importingCanvaId,
    selectedCanvaDesignId,
    canvaPrompt,
    setCanvaPrompt,
    editingWithAi,
    handleEditCanvaWithAi,
    setSelectedCanvaDesignId,
  } = controller;
  return (
    <>
      {" "}
      {tab === "image" && (
        <div className="animate-fadeIn space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-350 to-blue-300 bg-clip-text text-transparent inline-flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-cyan-400" />
                Elegí tu herramienta creativa
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Generá una imagen, creá un video o importá un diseño de Canva.
              </p>
            </div>

            {/* Indicador dinámico de estado del servicio actual */}
            <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-1.5 self-start md:self-auto">
              {imageSource === "openai" ? (
                openaiApiKey || openaiEnvKeySet ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                      OpenAI configurado
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">
                      Configurá la clave de OpenAI
                    </span>
                  </>
                )
              ) : imageSource === "gemini" ? (
                geminiApiKey || geminiEnvKeySet ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                      Gemini configurado
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">
                      Configurá la clave de Gemini
                    </span>
                  </>
                )
              ) : imageSource === "comfyui" || imageSource === "wan-video" ? (
                serviceToggling === "comfyui" ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                    <span className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider">
                      Iniciando ComfyUI...
                    </span>
                  </>
                ) : comfyuiActive ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-450 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                      ComfyUI Encendido
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                      ComfyUI Apagado
                    </span>
                  </>
                )
              ) : serviceToggling === "canva" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                  <span className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider">
                    Iniciando Canva...
                  </span>
                </>
              ) : canvaServerActive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">
                    Canva Server Activo
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Canva Server Apagado
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="premium-glass-card rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 glow-overlay-cyan pointer-events-none rounded-full" />

            {/* Switcher para ComfyUI / Gemini / OpenAI / Canva / Wan Video */}
            <div className="inline-flex flex-wrap p-1 bg-black/40 border border-white/[0.08] rounded-xl gap-1 relative z-10 shadow-sm">
              <button
                onClick={() => setImageSource("comfyui")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  imageSource === "comfyui"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                🎨 Generar con ComfyUI
              </button>
              <button
                onClick={() => setImageSource("wan-video")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  imageSource === "wan-video"
                    ? "bg-gradient-to-r from-violet-600/30 to-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm shadow-indigo-500/10 font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                <span>🎬</span> Video Wan 2.2 (14B)
              </button>
              <button
                onClick={() => setImageSource("gemini")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  imageSource === "gemini"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                🍌 Google Gemini
              </button>
              <button
                onClick={() => setImageSource("openai")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  imageSource === "openai"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                🟢 OpenAI (DALL-E)
              </button>
              <button
                onClick={() => setImageSource("canva")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  imageSource === "canva"
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                🔷 Diseños de Canva
              </button>
            </div>

            {imageSource === "wan-video" ? (
              <div className="space-y-6 relative z-10">
                {comfyuiActive === null ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                  </div>
                ) : !comfyuiActive ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="text-4xl">🎬</div>
                    <h3 className="text-sm font-bold text-slate-200">
                      El servidor de ComfyUI está apagado
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Encendé ComfyUI para generar videos cinemáticos localmente
                      con Wan 2.2 14B. Requiere tus 24GB de VRAM en RTX 3090.
                    </p>
                    <Button
                      onClick={() => handleToggleService("comfyui", "start")}
                      disabled={serviceToggling === "comfyui"}
                      className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all duration-300 cursor-pointer"
                    >
                      {serviceToggling === "comfyui" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Iniciando ComfyUI...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Usar ComfyUI
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Wan 2.2 Info Banner */}
                    <div className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-950/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xl">
                          🎬
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-indigo-200">
                            Wan 2.2 14B Text-to-Video Studio
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Modelo T2V 14B Dual-UNET (High/Low Noise) + VAE Wan
                            2.1 + LoRA Lightning
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400">
                          NVIDIA RTX 3090 (24GB VRAM)
                        </span>
                      </div>
                    </div>

                    {/* Prompt Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Prompt del Video (Acción, iluminación y movimiento de
                          cámara)
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            const presets = [
                              "Beautiful young European woman with honey blonde hair gracefully turning her head back over shoulder, gentle smile, bright eyes looking at camera. Hair flowing in slow motion as she turns. Soft natural lighting, clean background, cinematic slow-motion portrait.",
                              "Futuristic glowing neural network cortex pulses with neon turquoise light, gentle 3D camera pan, shallow depth of field, high-tech cybernetic atmosphere, 4k ultra detailed.",
                              "A luxury sleek perfume glass bottle rotating slowly on a wet dark obsidian stone pedestal, cinematic water droplets, warm dramatic studio rim lighting, 8k resolution commercial.",
                              "Steaming cup of specialty espresso coffee on a rustic wooden table in a sunlit modern cafe, slow camera push-in, soft morning sunbeams, cozy ambient dust particles.",
                            ];
                            const randomPreset =
                              presets[
                                Math.floor(Math.random() * presets.length)
                              ];
                            setVideoPrompt(randomPreset);
                          }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          Ejemplo cinemático
                        </button>
                      </div>
                      <Textarea
                        value={videoPrompt}
                        onChange={(e) => setVideoPrompt(e.target.value)}
                        placeholder="Describe la escena, sujeto, movimiento de cámara y luz... (Ej: Cinematic slow-motion portrait, camera gently tracking...)"
                        className="min-h-[110px] bg-white/[0.02] border-white/[0.08] focus:border-indigo-500/40 text-slate-100 text-xs rounded-xl p-3.5 resize-none leading-relaxed"
                      />
                    </div>

                    {/* Controles de Configuración de Video */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Aspect Ratio */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Formato / Relación
                        </Label>
                        <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/40 border border-white/[0.08] rounded-xl">
                          {[
                            { id: "9:16", label: "9:16", sub: "Reels" },
                            { id: "1:1", label: "1:1", sub: "Feed" },
                            { id: "16:9", label: "16:9", sub: "Cine" },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                setVideoAspectRatio(item.id as any)
                              }
                              className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                                videoAspectRatio === item.id
                                  ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm"
                                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
                              }`}
                            >
                              <div>{item.label}</div>
                              <div className="text-[9px] opacity-70 font-normal">
                                {item.sub}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Duración */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Duración (Segundos)
                        </Label>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 border border-white/[0.08] rounded-xl">
                          {[
                            { sec: 3, label: "3 seg", sub: "49 frames" },
                            { sec: 5, label: "5 seg", sub: "81 frames" },
                          ].map((item) => (
                            <button
                              key={item.sec}
                              type="button"
                              onClick={() => setVideoDuration(item.sec)}
                              className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                                videoDuration === item.sec
                                  ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm"
                                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
                              }`}
                            >
                              <div>{item.label}</div>
                              <div className="text-[9px] opacity-70 font-normal">
                                {item.sub}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Modo Velocidad / Calidad */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Motor de Sampler
                        </Label>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 border border-white/[0.08] rounded-xl">
                          <button
                            type="button"
                            onClick={() => setVideoLightning(true)}
                            className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                              videoLightning
                                ? "bg-amber-500/20 text-amber-200 border border-amber-500/30 shadow-sm"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
                            }`}
                          >
                            <div>⚡ Rápido</div>
                            <div className="text-[9px] opacity-70 font-normal">
                              4 pasos LoRA
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setVideoLightning(false)}
                            className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                              !videoLightning
                                ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent"
                            }`}
                          >
                            <div>💎 Calidad</div>
                            <div className="text-[9px] opacity-70 font-normal">
                              20 pasos Euler
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Negative Prompt (Opcional) */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Prompt Negativo (Filtro de artefactos)
                      </Label>
                      <Input
                        value={videoNegativePrompt}
                        onChange={(e) => setVideoNegativePrompt(e.target.value)}
                        placeholder="distorted text, blurry, deformed limbs, watermark, bad anatomy (por defecto optimizado)"
                        className="bg-white/[0.01] border-white/[0.06] text-slate-300 text-xs rounded-xl h-10 px-3.5"
                      />
                    </div>

                    {/* Botón de Generación */}
                    <div className="pt-2">
                      <Button
                        onClick={handleGenerateVideo}
                        disabled={videoLoading || !videoPrompt.trim()}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-650 hover:from-violet-500 hover:to-purple-550 text-white font-bold text-xs shadow-xl shadow-indigo-500/20 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2.5"
                      >
                        {videoLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>
                              Renderizando video Wan 2.2 14B en GPU... (30s -
                              2m)
                            </span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-indigo-200" />
                            <span>🎬 Generar Video con Wan 2.2 (14B T2V)</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Estado de carga animado */}
                    {videoLoading && (
                      <div className="p-8 rounded-2xl border border-indigo-500/20 bg-indigo-950/[0.05] text-center space-y-4 animate-pulse">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-2xl">
                          ⏳
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-indigo-200">
                            ComfyUI procesando flujo Wan 2.2 14B
                          </p>
                          <p className="text-xs text-slate-400">
                            KSampler (
                            {videoLightning
                              ? "4 pasos LoRA ultra rápido"
                              : "20 pasos completos"}
                            ) + VAE Decode + Guardado MP4
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Resultado Generado (Reproductor HTML5) */}
                    {generatedVideo && !videoLoading && (
                      <div className="space-y-4 animate-fadeIn pt-4 border-t border-white/[0.06]">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                            <span>✓</span> Video Renderizado (
                            {videoElapsed || "Completado"})
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {videoAspectRatio} · {videoDuration}s
                          </span>
                        </div>

                        <div className="rounded-2xl overflow-hidden border border-indigo-500/30 bg-black/80 shadow-2xl relative flex items-center justify-center max-h-[520px]">
                          <video
                            src={generatedVideo}
                            controls
                            autoPlay
                            loop
                            playsInline
                            className="w-full h-auto max-h-[500px] object-contain rounded-xl"
                          />
                        </div>

                        {/* Acciones para el video */}
                        <div className="flex flex-col sm:flex-row gap-3">
                          <a
                            href={generatedVideo}
                            download="wan-video-14b.mp4"
                            className="flex-1 h-11 text-center text-xs font-semibold rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] text-slate-200 hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4 text-slate-400" />
                            Descargar MP4
                          </a>
                          <button
                            onClick={() => setGeneratedVideo(null)}
                            className="flex-1 h-11 text-xs font-semibold rounded-xl bg-white/[0.02] border border-white/[0.08] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-slate-400 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            Descartar
                          </button>
                          <button
                            onClick={() => {
                              if (!message.trim()) {
                                setMessage(
                                  videoPrompt ||
                                    "Video cinemático generado con Wan 2.2 14B",
                                );
                              }
                              setTab("publish");
                              toast.success("Video cargado en el publicador");
                            }}
                            className="flex-1 h-11 text-xs font-semibold rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-650/30 border border-indigo-500/40 hover:border-indigo-400/60 text-indigo-300 hover:text-indigo-200 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                            Llevar a Publicar / Reel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : imageSource !== "canva" ? (
              <div className="space-y-6 relative z-10">
                {!selectedGenerator.startsWith("gemini-") &&
                !selectedGenerator.startsWith("dall-e-") &&
                comfyuiActive === null ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  </div>
                ) : !selectedGenerator.startsWith("gemini-") &&
                  !selectedGenerator.startsWith("dall-e-") &&
                  !comfyuiActive ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="text-4xl">🎨</div>
                    <h3 className="text-sm font-bold text-slate-200">
                      El servidor de ComfyUI está apagado
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Encendé ComfyUI para poder generar imágenes realistas con
                      FLUX / Ideogram localmente. Esto cargará los pesos del
                      modelo en tu VRAM.
                    </p>
                    <Button
                      onClick={() => handleToggleService("comfyui", "start")}
                      disabled={serviceToggling === "comfyui"}
                      className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-650 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all duration-300 cursor-pointer"
                    >
                      {serviceToggling === "comfyui" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Iniciando ComfyUI...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Usar ComfyUI
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Asistente de Idea Rápida (LLM) */}
                    <div className="p-5 rounded-2xl border border-purple-500/15 bg-purple-950/[0.02] shadow-[0_4px_30px_rgba(0,0,0,0.4)] backdrop-blur-md relative overflow-hidden group space-y-3">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[50px] rounded-full pointer-events-none" />
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                        <h4 className="text-xs font-bold text-purple-300 uppercase tracking-widest">
                          Asistente de Idea Rápida (LLM)
                        </h4>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Textarea
                          value={quickIdea}
                          onChange={(e) => setQuickIdea(e.target.value)}
                          placeholder="Ej: crea un flyer de oferta especial con un 20% de descuento en el plan anual, estilo minimalista con los colores de la marca"
                          className="flex-1 bg-white/[0.01] border-white/[0.08] placeholder:text-slate-650 focus:border-purple-500/40 text-slate-100 text-xs rounded-xl px-4.5 py-3 h-14 resize-none"
                        />
                        <Button
                          onClick={handleExpandQuickIdea}
                          disabled={expandingIdea}
                          className="h-14 sm:w-44 rounded-xl bg-purple-600 hover:bg-purple-550 text-white font-bold text-xs shadow-lg shadow-purple-500/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          {expandingIdea ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Parseando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Autocompletar con IA</span>
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-[9px] text-slate-600 font-medium">
                        Autocompletá todo el formulario inferior a partir de tu
                        idea rápida.
                      </p>
                    </div>

                    {/* Generator selector & Stop Button */}
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                      <div className="space-y-2 flex-1">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Generador de Imagen
                        </Label>
                        <Select
                          value={selectedGenerator}
                          onValueChange={(val) => {
                            if (val) {
                              setSelectedGenerator(val as ImageGenerator);
                              setGenParams(
                                getInitialParams(val as ImageGenerator),
                              );
                              setGeneratedImage(null);
                            }
                          }}
                        >
                          <SelectTrigger className="bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15] h-11 text-sm rounded-xl px-4">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-slate-200 max-h-[300px]">
                            {(
                              Object.values(GENERATORS) as Array<{
                                id: string;
                                name: string;
                                emoji: string;
                                description: string;
                              }>
                            )
                              .filter((gen) => {
                                if (imageSource === "gemini")
                                  return gen.id.startsWith("gemini-");
                                if (imageSource === "openai")
                                  return gen.id.startsWith("dall-e-");
                                return (
                                  !gen.id.startsWith("gemini-") &&
                                  !gen.id.startsWith("dall-e-")
                                );
                              })
                              .map((gen) => (
                                <SelectItem
                                  key={gen.id}
                                  value={gen.id}
                                  className="hover:bg-white/[0.06] focus:bg-white/[0.06] rounded-lg cursor-pointer"
                                >
                                  <span className="mr-2">{gen.emoji}</span>
                                  <span className="font-semibold text-slate-200">
                                    {gen.name}
                                  </span>
                                  <span className="text-slate-500 ml-2 text-xs">
                                    · {gen.description}
                                  </span>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {imageSource === "comfyui" && (
                        <Button
                          onClick={() => handleToggleService("comfyui", "stop")}
                          disabled={serviceToggling === "comfyui"}
                          className="h-11 px-5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-semibold rounded-xl transition-all duration-300 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                        >
                          {serviceToggling === "comfyui" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "🔌 Detener ComfyUI"
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Relación de Aspecto y Resolución */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Relación de Aspecto
                        </Label>
                        <Select
                          value={aspectRatioPreset}
                          onValueChange={(val) => {
                            if (val) {
                              setAspectRatioPreset(val);
                              if (val !== "custom") {
                                const dims: Record<
                                  string,
                                  { w: number; h: number }
                                > = {
                                  "1:1": { w: 1024, h: 1024 },
                                  "9:16": { w: 768, h: 1360 },
                                  "4:3": { w: 768, h: 1024 },
                                };
                                const selectDim = dims[val];
                                if (selectDim) {
                                  setGenParams((prev) => ({
                                    ...prev,
                                    width: selectDim.w,
                                    height: selectDim.h,
                                  }));
                                }
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15] h-10 text-xs rounded-xl px-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-xs">
                            <SelectItem
                              value="1:1"
                              className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                            >
                              1:1 (Feed / Cuadrado)
                            </SelectItem>
                            <SelectItem
                              value="9:16"
                              className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                            >
                              9:16 (Historia / Reel)
                            </SelectItem>
                            <SelectItem
                              value="4:3"
                              className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                            >
                              4:3 (Estándar / Poster)
                            </SelectItem>
                            <SelectItem
                              value="custom"
                              className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                            >
                              Personalizado (Manual)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Ancho (px)
                        </Label>
                        <Input
                          type="number"
                          disabled={aspectRatioPreset !== "custom"}
                          value={Number(
                            genParams.width ??
                              GENERATORS[selectedGenerator].defaultParams
                                .width ??
                              1024,
                          )}
                          onChange={(e) =>
                            setGenParams((prev) => ({
                              ...prev,
                              width: Number(e.target.value),
                            }))
                          }
                          className="premium-input bg-white/[0.02] border-white/[0.08] h-10 text-xs rounded-xl px-3 disabled:opacity-50"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Alto (px)
                        </Label>
                        <Input
                          type="number"
                          disabled={aspectRatioPreset !== "custom"}
                          value={Number(
                            genParams.height ??
                              GENERATORS[selectedGenerator].defaultParams
                                .height ??
                              1024,
                          )}
                          onChange={(e) =>
                            setGenParams((prev) => ({
                              ...prev,
                              height: Number(e.target.value),
                            }))
                          }
                          className="premium-input bg-white/[0.02] border-white/[0.08] h-10 text-xs rounded-xl px-3 disabled:opacity-50"
                        />
                      </div>
                    </div>
                    {/* Prompt fields grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Sujeto principal */}
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Sujeto Principal
                        </Label>
                        <Input
                          value={imageSubject}
                          onChange={(e) => setImageSubject(e.target.value)}
                          placeholder="Ej: tienda de ropa moderna con luces cálidas, maniquíes..."
                          className="premium-input bg-white/[0.02] border-white/[0.08] placeholder:text-slate-650 focus:border-cyan-500/50 focus:ring-cyan-500/20 h-11 text-sm rounded-xl px-4"
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            !imageLoading &&
                            handleGenerateImage()
                          }
                        />
                        <p className="text-[10px] text-slate-600">
                          Obligatorio. Describí el elemento central de la
                          imagen.
                        </p>
                      </div>

                      {/* Texto, Subtítulo y Viñetas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:col-span-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Texto en la imagen
                          </Label>
                          <Input
                            value={imageText}
                            onChange={(e) => setImageText(e.target.value)}
                            placeholder="Ej: OFERTA 50%, Black Friday..."
                            className="premium-input bg-white/[0.02] border-white/[0.08] placeholder:text-slate-650 focus:border-cyan-500/50 focus:ring-cyan-500/20 h-11 text-sm rounded-xl px-4"
                          />
                          <p className="text-[10px] text-slate-600">
                            Título principal en la imagen (máx 3-4 palabras)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Subtítulo en la imagen
                          </Label>
                          <Input
                            value={imageSubtitle}
                            onChange={(e) => setImageSubtitle(e.target.value)}
                            placeholder="Ej: Solo por hoy, Cupón limitado..."
                            className="premium-input bg-white/[0.02] border-white/[0.08] placeholder:text-slate-650 focus:border-cyan-500/50 focus:ring-cyan-500/20 h-11 text-sm rounded-xl px-4"
                          />
                          <p className="text-[10px] text-slate-600">
                            Texto secundario más pequeño
                          </p>
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Viñetas / Características al pie
                          </Label>
                          <Input
                            value={imageBullets}
                            onChange={(e) => setImageBullets(e.target.value)}
                            placeholder="Ej: Envío gratis, Garantía total, Cuotas sin interés..."
                            className="premium-input bg-white/[0.02] border-white/[0.08] placeholder:text-slate-650 focus:border-cyan-500/50 focus:ring-cyan-500/20 h-11 text-sm rounded-xl px-4"
                          />
                          <p className="text-[10px] text-slate-600">
                            Características separadas por comas (máximo 3 de 2
                            palabras c/u)
                          </p>
                        </div>
                      </div>

                      {/* Opciones de estilo, variación de ángulo, colocación y estilo de texto */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:col-span-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Estilo Artístico
                          </Label>
                          <Select
                            value={imageStyle}
                            onValueChange={(val) => val && setImageStyle(val)}
                          >
                            <SelectTrigger className="bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15] h-11 text-sm rounded-xl px-4">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-slate-350 max-h-[300px]">
                              {IMAGE_STYLES.map((style) => (
                                <SelectItem
                                  key={style.value}
                                  value={style.value}
                                  className="hover:bg-white/[0.06] focus:bg-white/[0.06] rounded-lg cursor-pointer"
                                >
                                  {style.prompt ? (
                                    <span className="text-[11px] text-slate-200">
                                      {style.label}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">
                                      Sin estilo
                                    </span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Variación / Ángulo
                          </Label>
                          <Select
                            value={dailyVariation}
                            onValueChange={(val) =>
                              val && setDailyVariation(val)
                            }
                          >
                            <SelectTrigger className="bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15] h-11 text-sm rounded-xl px-4">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-slate-350">
                              <SelectItem
                                value="ninguno"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Ninguna (Idea libre)
                              </SelectItem>
                              <SelectItem
                                value="oferta"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Oferta / Descuento
                              </SelectItem>
                              <SelectItem
                                value="consejo"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Tip / Consejo diario
                              </SelectItem>
                              <SelectItem
                                value="novedad"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Novedad / Lanzamiento
                              </SelectItem>
                              <SelectItem
                                value="testimonio"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Testimonio / Quote
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Posición del Texto
                          </Label>
                          <Select
                            value={textLayout}
                            onValueChange={(val) => val && setTextLayout(val)}
                          >
                            <SelectTrigger className="bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15] h-11 text-sm rounded-xl px-4">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-slate-350">
                              <SelectItem
                                value="ninguno"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Por defecto (Auto)
                              </SelectItem>
                              <SelectItem
                                value="arriba"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Parte superior
                              </SelectItem>
                              <SelectItem
                                value="centro"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Centro destacado
                              </SelectItem>
                              <SelectItem
                                value="abajo"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Parte inferior
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Estilo de Texto
                          </Label>
                          <Select
                            value={textStylePreset}
                            onValueChange={(val) =>
                              val && setTextStylePreset(val)
                            }
                          >
                            <SelectTrigger className="bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15] h-11 text-sm rounded-xl px-4">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-slate-350">
                              <SelectItem
                                value="modern-white"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Blanco con sombra
                              </SelectItem>
                              <SelectItem
                                value="sticker-black"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Etiqueta Sticker
                              </SelectItem>
                              <SelectItem
                                value="neon-glow"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Brillo de Neón
                              </SelectItem>
                              <SelectItem
                                value="luxury-gold"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Elegante Dorado
                              </SelectItem>
                              <SelectItem
                                value="3d-inflated"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                3D Inflado
                              </SelectItem>
                              <SelectItem
                                value="default"
                                className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                              >
                                Por defecto (Limpio)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Brand preferences are automatically injected in the backend prompt context */}
                      <div className="space-y-2 md:col-span-2 p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                        <h5 className="text-xs font-bold text-slate-300">
                          ✨ Preferencias de Marca
                        </h5>
                        <p className="text-[10px] text-slate-500">
                          Tus colores y logos se inyectarán automáticamente
                          según la marca seleccionada en tu perfil.
                        </p>
                      </div>

                      {/* Detalles adicionales */}
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Detalles adicionales
                        </Label>
                        <Input
                          value={imageDetails}
                          onChange={(e) => setImageDetails(e.target.value)}
                          placeholder="Ej: ambiente cálido, iluminación suave, fondo desenfocado..."
                          className="premium-input bg-white/[0.02] border-white/[0.08] placeholder:text-slate-650 focus:border-cyan-500/50 focus:ring-cyan-500/20 h-11 text-sm rounded-xl px-4"
                        />
                      </div>

                      {/* Prompt negativo */}
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Prompt Negativo (qué evitar)
                        </Label>
                        <Input
                          value={imageNegative}
                          onChange={(e) => setImageNegative(e.target.value)}
                          placeholder="Ej: borroso, texto ilegible, deformado, baja calidad, agua, marco..."
                          className="premium-input bg-white/[0.02] border-white/[0.08] placeholder:text-slate-650 focus:border-red-500/50 focus:ring-red-500/20 h-11 text-sm rounded-xl px-4"
                        />
                        <p className="text-[10px] text-slate-600">
                          Cosas que NO querés que aparezcan en la imagen
                        </p>
                      </div>
                    </div>

                    {/* Params grid */}
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Parámetros avanzados
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                        {GENERATORS[selectedGenerator].params
                          .filter(
                            (param) =>
                              param.id !== "width" && param.id !== "height",
                          )
                          .map((param) => {
                            const currentVal =
                              genParams[param.id] ?? param.default;
                            return (
                              <div key={param.id} className="space-y-1.5">
                                <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                  {param.label}
                                </Label>
                                {param.type === "select" && param.options ? (
                                  <Select
                                    value={String(currentVal)}
                                    onValueChange={(val) =>
                                      val &&
                                      setGenParams((p) => ({
                                        ...p,
                                        [param.id]: val,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15] h-9 text-xs rounded-lg px-3">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-xs">
                                      {param.options.map((opt) => (
                                        <SelectItem
                                          key={opt.value}
                                          value={opt.value}
                                          className="hover:bg-white/[0.06] text-xs rounded-lg cursor-pointer"
                                        >
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    type="number"
                                    min={param.min}
                                    max={param.max}
                                    step={param.step}
                                    value={Number(currentVal)}
                                    onChange={(e) =>
                                      setGenParams((p) => ({
                                        ...p,
                                        [param.id]: Number(e.target.value),
                                      }))
                                    }
                                    className="premium-input bg-white/[0.02] border-white/[0.08] h-9 text-xs focus:border-cyan-500/50 rounded-lg px-3"
                                  />
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    <Button
                      onClick={handleGenerateImage}
                      disabled={imageLoading}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-600 via-teal-650 to-blue-650 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.005] active:scale-[0.995] transition-all duration-300 cursor-pointer"
                    >
                      {imageLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          Generando con {GENERATORS[selectedGenerator].name}...
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-cyan-200" />
                          Generar imagen
                        </span>
                      )}
                    </Button>

                    {/* Loading state */}
                    {imageLoading && (
                      <div className="flex items-center justify-center h-72 rounded-2xl bg-white/[0.01] border border-white/[0.05] animate-pulse">
                        <div className="text-center space-y-3">
                          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
                          <p className="text-sm text-slate-400 font-medium">
                            {GENERATORS[selectedGenerator].name} generando...
                          </p>
                          <p className="text-xs text-slate-500">
                            Cargando pesos del modelo en VRAM...
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Preview */}
                    {generatedImage && !imageLoading && (
                      <div className="space-y-4 animate-fadeIn pt-4 border-t border-white/[0.06]">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Resultado Generado
                        </div>
                        <div
                          onClick={() => setShowImageLightbox(true)}
                          className="rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.01] shadow-2xl relative group cursor-zoom-in"
                        >
                          <img
                            src={generatedImage}
                            alt={`Generada con ${GENERATORS[selectedGenerator].name}`}
                            className="w-full h-auto object-cover max-h-[500px] transition-transform duration-500 group-hover:scale-[1.01]"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs font-bold shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                              <ImageIcon className="w-4 h-4 text-cyan-300 animate-pulse" />
                              <span>Click para ver en pantalla completa</span>
                            </div>
                          </div>
                        </div>

                        {/* Branding Overlay Tool */}
                        <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] space-y-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Superposición de Branding (Logo Fijo)</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                Logo de Marca
                              </Label>
                              <Select
                                value={selectedLogo}
                                onValueChange={(val) =>
                                  val && setSelectedLogo(val)
                                }
                              >
                                <SelectTrigger className="bg-white/[0.02] border-white/[0.08] h-9 text-xs rounded-lg px-3">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-xs">
                                  <SelectItem
                                    value="ninguno"
                                    className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                                  >
                                    Ninguno (Fondo limpio)
                                  </SelectItem>
                                  {brands.map((b) => (
                                    <SelectItem
                                      key={b.id}
                                      value={b.id}
                                      className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                                    >
                                      {b.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                Esquina / Posición
                              </Label>
                              <Select
                                value={logoPosition}
                                onValueChange={(val) =>
                                  val && setLogoPosition(val)
                                }
                              >
                                <SelectTrigger className="bg-white/[0.02] border-white/[0.08] h-9 text-xs rounded-lg px-3">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-xs">
                                  <SelectItem
                                    value="top_left"
                                    className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                                  >
                                    Arriba Izquierda
                                  </SelectItem>
                                  <SelectItem
                                    value="top_right"
                                    className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                                  >
                                    Arriba Derecha
                                  </SelectItem>
                                  <SelectItem
                                    value="bottom_left"
                                    className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                                  >
                                    Abajo Izquierda
                                  </SelectItem>
                                  <SelectItem
                                    value="bottom_right"
                                    className="hover:bg-white/[0.06] rounded-lg cursor-pointer"
                                  >
                                    Abajo Derecha
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <Button
                                onClick={handleApplyBrandLogo}
                                disabled={
                                  selectedLogo === "ninguno" || applyingBrand
                                }
                                className="w-full h-9 rounded-lg bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm border border-purple-550/20"
                              >
                                {applyingBrand ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Aplicando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Cpu className="w-3.5 h-3.5 text-purple-300" />
                                    <span>Aplicar Logo</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={() => {
                              setComposerInitialImage(generatedImage);
                              setTab("composer");
                            }}
                            className="flex-1 h-11 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600/25 to-teal-600/25 border border-emerald-500/35 hover:border-emerald-400/50 text-emerald-300 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Layers className="w-4 h-4" /> Editar en Capas
                          </button>
                          <a
                            href={generatedImage}
                            download="saas-hub-image.png"
                            className="flex-1 h-11 text-center text-xs font-semibold rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] text-slate-200 hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4 text-slate-455" />
                            Descargar
                          </a>
                          <button
                            onClick={() => setGeneratedImage(null)}
                            className="flex-1 h-11 text-xs font-semibold rounded-xl bg-white/[0.02] border border-white/[0.08] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-slate-400 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            Descartar
                          </button>
                          <button
                            onClick={() => {
                              setMessage(
                                message || "Post con imagen generada por IA",
                              );
                              setTab("publish");
                            }}
                            className="flex-1 h-11 text-xs font-semibold rounded-xl bg-gradient-to-r from-blue-600/25 to-cyan-650/25 border border-blue-500/35 hover:border-blue-400/50 text-blue-300 hover:text-blue-200 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                            Llevar a Publicar
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-6 relative z-10">
                {canvaServerActive === null ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  </div>
                ) : !canvaServerActive ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="text-4xl">🔷</div>
                    <h3 className="text-sm font-bold text-slate-200">
                      El servidor de Canva está apagado
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Encendé el servidor local de Canva para poder autenticar
                      tu cuenta y listar tus diseños de Canva.
                    </p>
                    <Button
                      onClick={() => handleToggleService("canva", "start")}
                      disabled={serviceToggling === "canva"}
                      className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-550 hover:to-indigo-550 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 transition-all duration-300 cursor-pointer"
                    >
                      {serviceToggling === "canva" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Iniciando Canva Server...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Usar Canva
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <>
                    {canvaConnected === null ? (
                      <div className="flex items-center justify-center h-48">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                      </div>
                    ) : !canvaConnected ? (
                      <div className="text-center py-12 space-y-4">
                        <div className="text-4xl">🔷</div>
                        <h3 className="text-sm font-bold text-slate-200">
                          Canva no está conectado
                        </h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                          Conectá tu cuenta de Canva para poder listar tus
                          diseños y publicarlos directamente en Facebook.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                          <a
                            href="http://localhost:8001/auth/login"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-550 hover:to-indigo-550 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 transition-all duration-300"
                          >
                            🔑 Conectar Canva o Autenticar
                          </a>
                          <Button
                            onClick={() => handleToggleService("canva", "stop")}
                            disabled={serviceToggling === "canva"}
                            className="h-11 px-5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-semibold rounded-xl transition-all duration-300 cursor-pointer flex items-center gap-1.5"
                          >
                            {serviceToggling === "canva" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "🔌 Detener Canva"
                            )}
                          </Button>
                        </div>
                        <div className="pt-2">
                          <button
                            onClick={checkCanvaStatus}
                            className="text-[10px] text-slate-500 hover:text-slate-350 uppercase tracking-wider font-bold cursor-pointer"
                          >
                            🔄 Verificar conexión
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Barra de Búsqueda de Canva */}
                        <div className="flex gap-3">
                          <Input
                            value={canvaSearchQuery}
                            onChange={(e) =>
                              setCanvaSearchQuery(e.target.value)
                            }
                            placeholder="Buscar diseños en Canva..."
                            className="premium-input bg-white/[0.02] border-white/[0.08] placeholder:text-slate-650 focus:border-purple-500/50 focus:ring-purple-500/20 h-11 text-sm rounded-xl px-4 flex-1"
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              fetchCanvaDesigns(canvaSearchQuery)
                            }
                          />
                          <Button
                            onClick={() => fetchCanvaDesigns(canvaSearchQuery)}
                            disabled={canvaLoading}
                            className="h-11 rounded-xl bg-purple-650 hover:bg-purple-500 text-white font-semibold px-5 transition-all duration-300 cursor-pointer"
                          >
                            {canvaLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Buscar"
                            )}
                          </Button>
                          <Button
                            onClick={handleCreateCanvaDesign}
                            disabled={creatingCanva}
                            className="h-11 rounded-xl bg-purple-650/10 border border-purple-500/20 hover:bg-purple-650/20 hover:border-purple-500/40 text-purple-300 font-semibold px-4 transition-all duration-300 cursor-pointer flex items-center gap-1.5"
                          >
                            {creatingCanva ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                Nuevo Diseño
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleToggleService("canva", "stop")}
                            disabled={serviceToggling === "canva"}
                            className="h-11 px-5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-semibold rounded-xl transition-all duration-300 cursor-pointer flex items-center gap-1.5"
                          >
                            {serviceToggling === "canva" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "🔌 Desconectar Canva"
                            )}
                          </Button>
                        </div>

                        {/* Formulario de creación desde plantilla */}
                        {templateDesignIdForCreation && (
                          <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-950/10 backdrop-blur-md space-y-4 animate-fadeIn">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-purple-300 flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4 text-purple-400" />
                                  Crear Nuevo Flyer / Diseño
                                </h4>
                                <p className="text-xs text-slate-400">
                                  Creando copia de:{" "}
                                  <span className="font-semibold text-slate-200">
                                    &quot;{templateDesignTitleForCreation}&quot;
                                  </span>
                                </p>
                              </div>
                              <Button
                                onClick={() => {
                                  setTemplateDesignIdForCreation(null);
                                  setTemplateDesignTitleForCreation(null);
                                }}
                                className="h-8 px-3 text-[10px] bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] text-slate-400 rounded-lg cursor-pointer"
                              >
                                Cancelar
                              </Button>
                            </div>
                            <div className="space-y-3">
                              <Label className="text-xs text-slate-300">
                                Instrucciones de la IA para personalizar tu
                                nuevo diseño:
                              </Label>
                              <div className="flex gap-3">
                                <Textarea
                                  value={creationPrompt}
                                  onChange={(e) =>
                                    setCreationPrompt(e.target.value)
                                  }
                                  placeholder="Ej: cambia el título a '¡Gran Inauguración!' y coloca el texto '50% de descuento en todas las pizzas familiares hoy viernes'..."
                                  className="premium-input bg-white/[0.02] border-white/[0.08] placeholder:text-slate-650 focus:border-purple-500/40 focus:ring-purple-500/10 text-xs rounded-xl p-3 flex-1 min-h-[70px] resize-none"
                                  disabled={creatingFromTemplate}
                                />
                                <Button
                                  onClick={handleCreateFlyerFromTemplate}
                                  disabled={
                                    !creationPrompt.trim() ||
                                    creatingFromTemplate
                                  }
                                  className="h-auto bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-550 hover:to-indigo-550 text-white font-semibold text-xs px-6 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
                                >
                                  {creatingFromTemplate ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Procesando...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4" />
                                      Crear y Editar con IA
                                    </>
                                  )}
                                </Button>
                              </div>
                              <p className="text-[10px] text-slate-500">
                                Este proceso duplicará automáticamente tu diseño
                                base en Canva y aplicará las modificaciones de
                                texto solicitadas mediante inteligencia
                                artificial sin tocar tu diseño original.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Listado de Diseños */}
                        {canvaLoading ? (
                          <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                          </div>
                        ) : canvaDesigns.length === 0 ? (
                          <div className="text-center py-12">
                            <p className="text-xs text-slate-400">
                              No se encontraron diseños. Creá uno en Canva
                              primero.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {canvaDesigns.map((design) => (
                              <div
                                key={design.id}
                                className="group rounded-xl border border-white/[0.06] bg-[#0c0c12] overflow-hidden hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/5 transition-all duration-300 flex flex-col justify-between"
                              >
                                <div className="aspect-video relative overflow-hidden bg-white/[0.01] border-b border-white/[0.03]">
                                  {design.thumbnail?.url ? (
                                    <img
                                      src={`/api/canva?action=proxy-image&url=${encodeURIComponent(design.thumbnail.url)}`}
                                      alt={design.title}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-650 bg-white/[0.01]">
                                      Sin miniatura
                                    </div>
                                  )}
                                  {design.urls?.edit && (
                                    <a
                                      href={design.urls.edit}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/85 text-[10px] text-purple-300 font-semibold px-2.5 py-1.5 rounded-lg backdrop-blur-sm border border-white/[0.05] transition-colors inline-flex items-center gap-1"
                                    >
                                      Editar{" "}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                                <div className="p-4 space-y-3">
                                  <h4
                                    className="text-xs font-semibold text-slate-200 line-clamp-1 truncate"
                                    title={design.title}
                                  >
                                    {design.title || "Diseño sin título"}
                                  </h4>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() =>
                                        handleImportCanvaDesign(design.id)
                                      }
                                      disabled={importingCanvaId !== null}
                                      className="flex-1 h-9 text-[10px] rounded-lg bg-white/[0.03] hover:bg-purple-650 hover:text-white border border-white/[0.08] hover:border-purple-550 transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                      {importingCanvaId === design.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        "Importar"
                                      )}
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        setTemplateDesignIdForCreation(
                                          design.id,
                                        );
                                        setTemplateDesignTitleForCreation(
                                          design.title,
                                        );
                                        // Scroll window up to see the creation form
                                        window.scrollTo({
                                          top: 100,
                                          behavior: "smooth",
                                        });
                                        toast.info(
                                          `Plantilla "${design.title}" seleccionada.`,
                                        );
                                      }}
                                      disabled={creatingFromTemplate}
                                      className="flex-1 h-9 text-[10px] rounded-lg bg-purple-650/10 border border-purple-500/20 hover:bg-purple-650 hover:border-purple-500/50 hover:text-white text-purple-300 transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      Plantilla
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Mostrar si ya hay una imagen importada de Canva */}
                        {generatedImage && !imageLoading && (
                          <div className="space-y-4 animate-fadeIn pt-4 border-t border-white/[0.06]">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Diseño Importado
                            </div>
                            <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.01] shadow-2xl relative max-w-sm mx-auto">
                              <img
                                src={generatedImage}
                                alt="Diseño de Canva"
                                className="w-full h-auto object-cover max-h-[300px]"
                              />
                            </div>

                            {/* Formulario para edición con IA de Canva */}
                            {selectedCanvaDesignId && (
                              <div className="max-w-sm mx-auto space-y-2 p-4 rounded-xl border border-purple-500/15 bg-purple-500/5">
                                <Label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 animate-pulse text-purple-400" />{" "}
                                  Modificar diseño con IA
                                </Label>
                                <div className="flex gap-2">
                                  <Textarea
                                    value={canvaPrompt}
                                    onChange={(e) =>
                                      setCanvaPrompt(e.target.value)
                                    }
                                    placeholder="Ej: cambia el título a 'Descuento 40%' y el precio a $499..."
                                    className="bg-white/[0.02] border-white/[0.08] placeholder:text-slate-650 focus:border-purple-500/40 focus:ring-purple-500/10 text-xs rounded-xl p-3 flex-1 min-h-[60px] resize-none"
                                    disabled={editingWithAi}
                                  />
                                  <Button
                                    onClick={() =>
                                      handleEditCanvaWithAi(
                                        selectedCanvaDesignId,
                                      )
                                    }
                                    disabled={
                                      !canvaPrompt.trim() || editingWithAi
                                    }
                                    className="h-auto bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center disabled:opacity-50"
                                  >
                                    {editingWithAi ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      "Aplicar"
                                    )}
                                  </Button>
                                </div>
                                <p className="text-[9px] text-slate-500 leading-normal">
                                  Un LLM analizará tu instrucción y modificará
                                  los bloques de texto de tu diseño en Canva de
                                  forma directa.
                                </p>
                              </div>
                            )}

                            <div className="flex gap-3 max-w-sm mx-auto">
                              <button
                                onClick={() => {
                                  setGeneratedImage(null);
                                  setSelectedCanvaDesignId(null);
                                }}
                                className="flex-1 h-11 text-xs font-semibold rounded-xl bg-white/[0.02] border border-white/[0.08] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-slate-400 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                                Descartar
                              </button>
                              <button
                                onClick={() => {
                                  setMessage(
                                    message || "Post con diseño de Canva",
                                  );
                                  setTab("publish");
                                }}
                                className="flex-1 h-11 text-xs font-semibold rounded-xl bg-gradient-to-r from-blue-600/25 to-cyan-650/25 border border-blue-500/35 hover:border-blue-400/50 text-blue-300 hover:text-blue-200 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Send className="w-4 h-4" />
                                Llevar a Publicar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}{" "}
    </>
  );
}
