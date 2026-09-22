"use client";

import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import type { ScheduledPost } from "@/lib/schedule-types";
import {
Calendar as CalendarIcon,
ChevronLeft,
ChevronRight,
Clock,
Copy,
ExternalLink,
Image as ImageIcon,
LayoutGrid,
List,
Loader2,
Trash2,
Zap
} from "lucide-react";
import { useMemo,useState } from "react";
import { toast } from "sonner";

interface SocialCalendarViewProps {
  posts: ScheduledPost[];
  onRefresh: () => void;
  onCancel: (id: string) => void;
}

const PLATFORM_ICONS: Record<string, { label: string; color: string; bg: string }> = {
  facebook: { label: "FB", color: "text-blue-400", bg: "bg-blue-600/20 border-blue-500/30" },
  instagram: { label: "IG", color: "text-pink-400", bg: "bg-pink-600/20 border-pink-500/30" },
  linkedin: { label: "LI", color: "text-sky-400", bg: "bg-sky-600/20 border-sky-500/30" },
  twitter: { label: "X", color: "text-slate-300", bg: "bg-slate-700/20 border-slate-600/30" },
  x: { label: "X", color: "text-slate-300", bg: "bg-slate-700/20 border-slate-600/30" },
};

const DAYS_OF_WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function SocialCalendarView({ posts, onRefresh, onCancel }: SocialCalendarViewProps) {
  const [viewMode, setViewMode] = useState<"calendar" | "instagram" | "list">("calendar");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [publishingNow, setPublishingNow] = useState(false);

  // Navegación de mes
  function prevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  // Generación de matriz mensual
  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Ajustar día de la semana (0 = Domingo -> 6, 1 = Lunes -> 0)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDay.getDate();

    const days: { date: Date; isCurrentMonth: boolean; dayNumber: number }[] = [];

    // Días del mes anterior para rellenar
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
        dayNumber: prevMonthLastDay - i,
      });
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
        dayNumber: i,
      });
    }

    // Días del mes siguiente para completar múltiplos de 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        dayNumber: i,
      });
    }

    return days;
  }, [currentDate]);

  // Agrupar posts por fecha YYYY-MM-DD
  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const post of posts) {
      const dateStr = post.scheduledAt || (post as any).scheduledTime;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    }
    return map;
  }, [posts]);

  // Posts ordenados para la cuadrícula de Instagram (posts con imagen)
  const instagramFeedPosts = useMemo(() => {
    return posts
      .filter((p) => !!p.imagePath)
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }, [posts]);

  // Forzar publicación inmediata
  async function handlePublishNow(postId: string) {
    setPublishingNow(true);
    toast.loading("Publicando inmediatamente en redes...", { id: "pub-now" });
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish-now", id: postId }),
      });
      const data = await res.json();
      toast.dismiss("pub-now");

      if (data.success) {
        toast.success("¡Publicación enviada exitosamente!");
        onRefresh();
        setSelectedPost(null);
      } else {
        toast.error("Error al publicar", { description: data.error });
      }
    } catch {
      toast.dismiss("pub-now");
      toast.error("Fallo de conexión al publicar");
    } finally {
      setPublishingNow(false);
    }
  }

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const monthName = currentDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Barra de Controles y Selector de Vista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#0b0b14]/90 border border-white/[0.08] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white capitalize">{monthName}</h3>
            <p className="text-[11px] text-slate-400">
              {posts.length} {posts.length === 1 ? "publicación programada" : "publicaciones programadas"} en total
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Navegación de Fecha */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevMonth}
              className="h-7 w-7 p-0 text-slate-400 hover:text-white"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToday}
              className="h-7 px-2.5 text-xs text-slate-300 hover:text-white font-semibold"
            >
              Hoy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={nextMonth}
              className="h-7 w-7 p-0 text-slate-400 hover:text-white"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Toggle de Modo de Vista */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "calendar"
                  ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.3)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mes</span>
            </button>
            <button
              onClick={() => setViewMode("instagram")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "instagram"
                  ? "bg-pink-600 text-white shadow-[0_0_12px_rgba(219,39,119,0.3)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mosaico visual</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "list"
                  ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.3)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* VISTA 1: CALENDARIO MENSUAL */}
      {viewMode === "calendar" && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b14]/90 overflow-hidden shadow-2xl backdrop-blur-md">
          {/* Cabecera de días de la semana */}
          <div className="grid grid-cols-7 border-b border-white/[0.06] bg-white/[0.02]">
            {DAYS_OF_WEEK.map((d, i) => (
              <div key={i} className="py-2.5 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Celdas del mes */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-white/[0.04]">
            {monthData.map(({ date, isCurrentMonth, dayNumber }, idx) => {
              const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const isToday = dateKey === todayStr;
              const dayPosts = postsByDay.get(dateKey) || [];

              return (
                <div
                  key={idx}
                  className={`min-h-[110px] sm:min-h-[130px] p-2 transition-colors flex flex-col justify-between ${
                    !isCurrentMonth
                      ? "bg-white/[0.005] opacity-40"
                      : isToday
                      ? "bg-purple-500/[0.04]"
                      : "hover:bg-white/[0.01]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? "bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                          : isCurrentMonth
                          ? "text-slate-300"
                          : "text-slate-600"
                      }`}
                    >
                      {dayNumber}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="text-[10px] font-bold text-purple-400 px-1.5 py-0.5 rounded bg-purple-500/10">
                        {dayPosts.length} {dayPosts.length === 1 ? "post" : "posts"}
                      </span>
                    )}
                  </div>

                  {/* Lista de posts programados en este día */}
                  <div className="space-y-1 mt-1.5 overflow-hidden">
                    {dayPosts.slice(0, 2).map((post) => {
                      const postTime = new Date(post.scheduledAt || (post as any).scheduledTime).toLocaleTimeString(
                        "es-AR",
                        { hour: "2-digit", minute: "2-digit" }
                      );
                      const isPublished = post.status === "published";
                      const isScheduled = post.status === "scheduled";

                      return (
                        <div
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          className={`p-1.5 rounded-lg border text-[10px] font-medium flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] shadow-sm ${
                            isPublished
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
                              : isScheduled
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-200"
                              : "bg-purple-500/10 border-purple-500/20 text-purple-200"
                          }`}
                          title={post.message}
                        >
                          {post.imagePath ? (
                            <img
                              src={post.imagePath}
                              alt="miniatura"
                              className="w-5 h-5 object-cover rounded shrink-0 border border-white/10"
                            />
                          ) : (
                            <Clock className="w-3 h-3 text-purple-400 shrink-0" />
                          )}
                          <span className="font-bold text-[9px] text-slate-300 shrink-0">{postTime}</span>
                          <span className="truncate flex-1">{post.message}</span>
                        </div>
                      );
                    })}

                    {dayPosts.length > 2 && (
                      <button
                        onClick={() => setSelectedPost(dayPosts[0])}
                        className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold pl-1 cursor-pointer block"
                      >
                        +{dayPosts.length - 2} más...
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISTA 2: INSTAGRAM FEED 3x3 MOCKUP */}
      {viewMode === "instagram" && (
        <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#0b0b14]/90 space-y-6 max-w-2xl mx-auto shadow-2xl backdrop-blur-md">
          <div className="text-center space-y-1 border-b border-white/[0.06] pb-4">
            <h4 className="text-sm font-bold text-white flex items-center justify-center gap-2">
              <LayoutGrid className="w-4 h-4 text-pink-400" />
              Previsualizador de Cuadrícula de Instagram
            </h4>
            <p className="text-xs text-slate-400">
              Así lucirá la armonía estética y visual de tu perfil de Instagram cuando se publiquen tus imágenes.
            </p>
          </div>

          {instagramFeedPosts.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <ImageIcon className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No hay publicaciones con imagen programadas en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {instagramFeedPosts.map((post) => {
                const dateStr = new Date(post.scheduledAt || (post as any).scheduledTime).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                });
                return (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="relative aspect-square group overflow-hidden rounded-lg bg-black/40 border border-white/[0.06] cursor-pointer"
                  >
                    <img
                      src={post.imagePath!}
                      alt="post feed"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex flex-col justify-between text-white backdrop-blur-[2px]">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-600 text-white">
                          {dateStr}
                        </span>
                        <span className={`text-[10px] font-bold ${post.status === "published" ? "text-emerald-400" : "text-purple-300"}`}>
                          {post.status === "published" ? "Publicado" : "Pendiente"}
                        </span>
                      </div>
                      <p className="text-[11px] line-clamp-3 text-slate-200 leading-snug">
                        {post.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA 3: LISTA AUDITABLE DETALLADA */}
      {viewMode === "list" && (
        <Card className="bg-[#0b0b14]/90 border-white/[0.08] shadow-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <List className="w-4 h-4 text-blue-400" />
              Gestión de Publicaciones Programadas
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Audita el estado de cada post, revisa links de Facebook o cancela elementos pendientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No hay publicaciones programadas activas.</p>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => {
                  const isPending = post.status === "pending" || post.status === "scheduled";
                  const isSuccess = post.status === "published";
                  const dateStr = new Date(post.scheduledAt || (post as any).scheduledTime).toLocaleString("es-AR");

                  return (
                    <div
                      key={post.id}
                      className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] transition-all flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {post.imagePath ? (
                          <img
                            src={post.imagePath}
                            alt="post preview"
                            className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                            <Clock className="w-5 h-5 text-purple-400" />
                          </div>
                        )}

                        <div className="space-y-1 min-w-0">
                          <p className="text-slate-200 font-medium truncate max-w-sm sm:max-w-md">{post.message}</p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1 text-purple-300 font-semibold">
                              <CalendarIcon className="w-3 h-3" /> {dateStr}
                            </span>
                            {/* Badges de plataformas */}
                            <div className="flex items-center gap-1">
                              {(post.platforms || ["facebook"]).map((p) => {
                                const conf = PLATFORM_ICONS[p] || PLATFORM_ICONS.facebook;
                                return (
                                  <span key={p} className={`px-1 py-0.2 rounded border text-[9px] font-bold ${conf.bg} ${conf.color}`}>
                                    {conf.label}
                                  </span>
                                );
                              })}
                            </div>
                            <span className={`font-bold ${isSuccess ? "text-emerald-400" : isPending ? "text-purple-400" : "text-red-400"}`}>
                              {post.fbScheduled ? "Nativo Facebook" : post.status === "published" ? "Publicado" : "Pendiente"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {post.permalink && (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="h-8 px-2.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold flex items-center gap-1 border border-blue-500/30"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Ver Post
                          </a>
                        )}

                        {isPending && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePublishNow(post.id)}
                              className="h-8 px-2.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              title="Publicar ahora de inmediato"
                            >
                              <Zap className="w-3.5 h-3.5 mr-1" /> Ahora
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onCancel(post.id)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                              title="Cancelar programación"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL DE DETALLE DEL POST PROGRAMADO */}
      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="bg-[#0e0e18] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-purple-300">
              <CalendarIcon className="w-4 h-4 text-purple-400" />
              Detalle de Publicación Programada
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {selectedPost &&
                new Date(selectedPost.scheduledAt || (selectedPost as any).scheduledTime).toLocaleString("es-AR", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
            </DialogDescription>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-4 pt-2">
              {selectedPost.imagePath && (
                <div className="rounded-xl overflow-hidden border border-white/10 max-h-64 bg-black/50">
                  <img
                    src={selectedPost.imagePath}
                    alt="preview grande"
                    className="w-full h-full object-contain max-h-64"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Copy / Texto</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedPost.message);
                      toast.success("Texto copiado al portapapeles");
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-200 leading-relaxed max-h-36 overflow-y-auto">
                  {selectedPost.message}
                </div>
              </div>

              {/* Redes Sociales Destino */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
                <span className="text-slate-400 font-semibold">Redes Destino:</span>
                <div className="flex items-center gap-1.5">
                  {(selectedPost.platforms || ["facebook"]).map((p) => {
                    const conf = PLATFORM_ICONS[p] || PLATFORM_ICONS.facebook;
                    return (
                      <span key={p} className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${conf.bg} ${conf.color}`}>
                        {p.toUpperCase()}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      selectedPost.status === "published"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-purple-500/10 text-purple-300"
                    }`}
                  >
                    {selectedPost.status.toUpperCase()}
                  </span>
                  {selectedPost.permalink && (
                    <a
                      href={selectedPost.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Ver en Facebook <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedPost.status !== "published" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onCancel(selectedPost.id);
                          setSelectedPost(null);
                        }}
                        className="text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Cancelar
                      </Button>
                      <Button
                        size="sm"
                        disabled={publishingNow}
                        onClick={() => handlePublishNow(selectedPost.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1 shadow-lg"
                      >
                        {publishingNow ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        Publicar Ya
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
