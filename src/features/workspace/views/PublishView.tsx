"use client";
import { SocialCalendarView } from "@/components/calendar/SocialCalendarView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { GENERATORS } from "@/lib/generators";
import {
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { WorkspaceController } from "../hooks/use-workspace";

export default function PublishView({
  controller,
}: {
  controller: WorkspaceController;
}) {
  const {
    tab,
    handleGenerateCaption,
    generatingCaption,
    setMessage,
    message,
    generatedVideo,
    setGeneratedVideo,
    generatedImage,
    selectedGenerator,
    setGeneratedImage,
    selectedPlatforms,
    setSelectedPlatforms,
    setPublishMode,
    publishMode,
    scheduledTime,
    setScheduledTime,
    handleSchedulePost,
    handlePublish,
    loading,
    pageId,
    pages,
    scheduledPosts,
    fetchScheduledPosts,
    handleCancelSchedule,
    history,
  } = controller;

  const currentPage = pages.find((page) => page.id === pageId);

  return (
    <>
      {tab === "publish" && (
        <div className="animate-fadeIn space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-sky-350 to-cyan-300 bg-clip-text text-transparent inline-flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-450" />
                Publicación Multired
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Distribuí contenido en Facebook, Instagram, LinkedIn y X para la marca seleccionada.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-1.5 self-start md:self-auto">
              <span className="text-xs text-slate-400">
                {currentPage?.connected
                  ? `Canal: ${currentPage.name}`
                  : "Conectá una página para publicar"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Left Column: Controls */}
            <div className="xl:col-span-3 space-y-6">
              <div className="premium-glass-card rounded-2xl p-6 space-y-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 glow-overlay-blue pointer-events-none rounded-full" />

                {/* Message */}
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Contenido del Post
                    </Label>
                    <div className="flex gap-3">
                      <button
                        onClick={handleGenerateCaption}
                        disabled={generatingCaption}
                        className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 disabled:opacity-50"
                      >
                        {generatingCaption ? (
                          <>
                            <Sparkles className="w-3 h-3 animate-pulse" />{" "}
                            Escribiendo...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" /> Redactar con IA
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setMessage("")}
                        className="text-[10px] text-slate-500 hover:text-red-400 font-semibold uppercase tracking-wider transition-colors cursor-pointer pt-0.5"
                      >
                        Limpiar
                      </button>
                      <span className="text-[10px] font-mono text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.02] pt-0.5">
                        {message.length} / 5000
                      </span>
                    </div>
                  </div>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribí el contenido del post o haz clic en 'Redactar con IA'..."
                    className="premium-input bg-white/[0.02] border-white/[0.08] resize-none min-h-[160px] placeholder:text-slate-750 focus:border-blue-500/50 focus:ring-blue-500/20 text-sm rounded-xl p-4 leading-relaxed"
                    maxLength={5000}
                  />
                </div>

                {/* Image / Video indicator */}
                {generatedVideo ? (
                  <div className="flex items-center gap-3 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 relative z-10">
                    <span className="text-lg">🎬</span>
                    <div className="flex-1 leading-relaxed">
                      El post se publicará con el{" "}
                      <strong>Video Wan 2.2 14B</strong> generado en local. Si
                      tiene formato vertical (9:16), Meta lo publicará como{" "}
                      <strong>Reel</strong>.
                    </div>
                    <button
                      onClick={() => setGeneratedVideo(null)}
                      className="text-slate-400 hover:text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer"
                      title="Quitar video"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  generatedImage && (
                    <div className="flex items-center gap-3 text-xs text-cyan-300 bg-cyan-500/5 border border-cyan-500/10 rounded-xl px-4 py-3 relative z-10">
                      <span className="text-lg">🖼</span>
                      <div className="flex-1 leading-relaxed">
                        El post se enviará incluyendo la imagen que generaste
                        previamente con{" "}
                        <strong>
                          {GENERATORS[selectedGenerator]?.name || "IA"}
                        </strong>
                      </div>
                      <button
                        onClick={() => setGeneratedImage(null)}
                        className="text-slate-400 hover:text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer"
                        title="Quitar imagen"
                      >
                        ✕
                      </button>
                    </div>
                  )
                )}

                {/* Redes Sociales Destino */}
                <div className="space-y-3 relative z-10 mt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Redes Sociales Destino
                    </Label>
                    {currentPage?.instagramUsername && (
                      <span className="text-[10px] font-semibold text-pink-400 flex items-center gap-1">
                        IG Vinculado: @{currentPage.instagramUsername}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        id: "facebook",
                        name: "Facebook",
                        color: "bg-blue-600",
                        badge: "Página",
                      },
                      {
                        id: "instagram",
                        name: "Instagram",
                        color: "bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500",
                        badge: "Reels / Feed",
                      },
                      {
                        id: "linkedin",
                        name: "LinkedIn",
                        color: "bg-sky-700",
                        badge: "Feed",
                      },
                      {
                        id: "x",
                        name: "X (Twitter)",
                        color: "bg-slate-800 border border-slate-600",
                        badge: "Post",
                      },
                    ].map((plat) => {
                      const isSelected = selectedPlatforms.includes(plat.id);
                      return (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (selectedPlatforms.length > 1)
                                setSelectedPlatforms(
                                  selectedPlatforms.filter((p) => p !== plat.id),
                                );
                            } else {
                              setSelectedPlatforms([
                                ...selectedPlatforms,
                                plat.id,
                              ]);
                            }
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? `${plat.color} text-white shadow-lg shadow-black/30 scale-[1.02]`
                              : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.1] border border-white/[0.05]"
                          }`}
                        >
                          <span>{plat.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-normal ${
                              isSelected
                                ? "bg-black/25 text-white/90"
                                : "bg-white/5 text-slate-500"
                            }`}
                          >
                            {plat.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Publish Mode Toggle */}
                <div className="flex gap-2 relative z-10 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setPublishMode("now")}
                    className={`flex-1 h-10 rounded-xl transition-all cursor-pointer ${
                      publishMode === "now"
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                        : "bg-white/[0.02] border-white/[0.08] text-slate-400 hover:text-slate-300 hover:border-white/[0.15]"
                    }`}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Publicar Ahora
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPublishMode("schedule")}
                    className={`flex-1 h-10 rounded-xl transition-all cursor-pointer ${
                      publishMode === "schedule"
                        ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                        : "bg-white/[0.02] border-white/[0.08] text-slate-400 hover:text-slate-300 hover:border-white/[0.15]"
                    }`}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Programar
                  </Button>
                </div>

                {/* Schedule DateTime Picker */}
                {publishMode === "schedule" && (
                  <div className="space-y-2 relative z-10 mt-4">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Fecha y Hora de Publicación
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <Input
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="premium-input bg-white/[0.02] border-white/[0.08] focus:border-purple-500/50 focus:ring-purple-500/20 text-sm rounded-xl pl-10 pr-4 h-11 text-slate-200 cursor-text w-full [color-scheme:dark]"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Seleccioná cuándo querés que se publique automáticamente.
                    </p>
                  </div>
                )}

                <div className="mt-4">
                  <Button
                    onClick={
                      publishMode === "schedule"
                        ? handleSchedulePost
                        : handlePublish
                    }
                    disabled={
                      loading || (publishMode === "schedule" && !scheduledTime)
                    }
                    className={`w-full h-12 rounded-xl text-white font-semibold shadow-lg transition-all duration-300 cursor-pointer relative z-10 ${
                      publishMode === "schedule"
                        ? "bg-gradient-to-r from-purple-600 via-pink-650 to-purple-600 hover:from-purple-500 hover:to-pink-550 shadow-purple-500/20 hover:shadow-purple-500/30"
                        : "bg-gradient-to-r from-blue-600 via-indigo-650 to-blue-600 hover:from-blue-500 hover:to-indigo-550 shadow-blue-500/20 hover:shadow-blue-500/30"
                    } hover:scale-[1.005] active:scale-[0.995]`}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        {publishMode === "schedule"
                          ? "Programando..."
                          : "Publicando en redes..."}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {publishMode === "schedule" ? (
                          <Clock className="w-4 h-4 text-purple-200" />
                        ) : (
                          <Send className="w-4 h-4 text-blue-200" />
                        )}
                        {publishMode === "schedule"
                          ? generatedVideo
                            ? "Programar Video / Reel"
                            : generatedImage
                              ? "Programar con imagen"
                              : "Programar post"
                          : generatedVideo
                            ? "Publicar Video / Reel"
                            : generatedImage
                              ? "Publicar con imagen"
                              : "Publicar ahora"}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column: Sleek Feed Preview */}
            <div className="xl:col-span-2 space-y-6">
              <div className="premium-glass-card rounded-2xl p-5 relative overflow-hidden border border-white/[0.06] bg-black/40">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                  Vista Previa Móvil (Simulada)
                </div>

                {/* Simulated Post */}
                <div className="rounded-xl border border-white/[0.05] bg-[#0c0c12] overflow-hidden shadow-2xl">
                  {/* Post Header */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar placeholder */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-sm border border-white/[0.08]">
                        {pageId
                          ? pages.find((p) => p.id === pageId)?.emoji || "📄"
                          : "👤"}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          {pageId
                            ? pages.find((p) => p.id === pageId)?.name
                            : "Nombre de la Página"}
                          <span className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center text-[7px] text-white">
                            ✓
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-500 font-medium">
                          Hace un momento · 🌐
                        </div>
                      </div>
                    </div>
                    <span className="text-slate-655 text-xs font-bold">
                      •••
                    </span>
                  </div>

                  {/* Post Content */}
                  <div className="px-4 pb-4">
                    <p className="text-xs text-slate-350 leading-relaxed whitespace-pre-wrap font-sans">
                      {message ||
                        "Escribí o generá un caption para ver cómo se verá tu publicación..."}
                    </p>
                  </div>

                  {/* Post Media (Video or Image) */}
                  {generatedVideo ? (
                    <div className="border-t border-white/[0.05] bg-black/70 aspect-video relative overflow-hidden flex items-center justify-center">
                      <video
                        src={generatedVideo}
                        controls
                        autoPlay
                        loop
                        playsInline
                        className="w-full h-full object-contain max-h-[360px]"
                      />
                    </div>
                  ) : generatedImage ? (
                    <div className="border-t border-white/[0.05] bg-black/40 aspect-video relative overflow-hidden">
                      <img
                        src={generatedImage}
                        alt="Post preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    message && (
                      <div className="border-t border-white/[0.03] bg-gradient-to-br from-white/[0.01] to-white/[0.03] py-8 px-4 text-center text-[10px] text-slate-650 font-medium italic border-b border-white/[0.03]">
                        Publicación solo de texto
                      </div>
                    )
                  )}

                  {/* Facebook Interactions Bar */}
                  <div className="px-4 py-2.5 bg-white/[0.01] border-t border-white/[0.04] flex justify-between text-slate-500 text-[10px] font-semibold">
                    <div className="flex items-center gap-1.5 hover:text-slate-300 transition-colors cursor-pointer">
                      <span>👍</span> Me gusta
                    </div>
                    <div className="flex items-center gap-1.5 hover:text-slate-300 transition-colors cursor-pointer">
                      <span>💬</span> Comentar
                    </div>
                    <div className="flex items-center gap-1.5 hover:text-slate-300 transition-colors cursor-pointer">
                      <span>🔁</span> Compartir
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Calendario Visual Social Interactivo (Mes, Feed Instagram, Lista) */}
          <div className="mb-6">
            <SocialCalendarView
              key={pageId}
              posts={scheduledPosts.filter(post => post.pageId === pageId)}
              onRefresh={fetchScheduledPosts}
              onCancel={handleCancelSchedule}
            />
          </div>

          {/* History List */}
          {history.length > 0 && (
            <div className="premium-glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-slate-200 inline-flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  Historial de publicaciones
                </h3>
                <span className="text-[10px] font-bold bg-white/[0.04] border border-white/[0.04] px-2 py-0.5 rounded-full text-slate-400">
                  {history.length} publicaciones
                </span>
              </div>

              <ScrollArea className="h-[250px] premium-scrollbar pr-2">
                <div className="space-y-3 pr-1">
                  {history.map((item, i) => {
                    const isSuccess = item.status.includes("Publicado");
                    return (
                      <div
                        key={i}
                        className="flex items-start justify-between text-xs p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-300"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 shrink-0">
                            {isSuccess ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-450" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-450" />
                            )}
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-350 shrink-0">
                                {item.page}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-slate-700 shrink-0" />
                              <span
                                className={`text-[10px] font-bold ${isSuccess ? "text-emerald-500/90" : "text-red-500/90"}`}
                              >
                                {item.status}
                              </span>
                            </div>
                            <p className="text-slate-500 truncate max-w-[280px] sm:max-w-[450px] md:max-w-[600px] leading-relaxed">
                              {item.message}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-600 font-semibold shrink-0 ml-4 mt-0.5">
                          {item.time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </>
  );
}
