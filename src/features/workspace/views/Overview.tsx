"use client";

import {
AlertCircle,
ArrowRight,
CalendarDays,
Check,
CheckCircle2,
Clock3,
Image,
Layers3,
Palette,
Sparkles,
} from "lucide-react";
import { useEffect,useState } from "react";
import type { TabId } from "../config";
import type { WorkspaceController } from "../hooks/use-workspace";

const formatDate = (value: string) =>
  new Date(value).toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function Overview({
  controller: c,
  onNavigate,
}: {
  controller: WorkspaceController;
  onNavigate: (tab: TabId) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const posts = c.scheduledPosts.filter((post) => post.pageId === c.pageId);
  const pending = posts.filter((post) =>
    ["pending", "scheduled", "publishing"].includes(post.status),
  );
  const next = [...pending]
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
    .slice(0, 4);
  const failed = posts.filter((post) => post.status === "failed");
  const overdue = pending.filter(
    (post) => Date.parse(post.scheduledAt) < now - 300000,
  );
  const attentionCount = failed.length + overdue.length;
  const page = c.pages.find((page) => page.id === c.pageId);
  const stats = [
    {
      label: "En calendario",
      value: pending.length,
      icon: CalendarDays,
      detail: "Publicaciones por salir",
      color: "mint",
    },
    {
      label: "Publicadas",
      value: posts.filter((post) => post.status === "published").length,
      icon: CheckCircle2,
      detail: "Desde tu calendario",
      color: "blue",
    },
    {
      label: "Necesitan atención",
      value: attentionCount,
      icon: AlertCircle,
      detail: attentionCount
        ? "Revisá antes de reintentar"
        : "Sin errores en la cola",
      color: "amber",
    },
  ];
  const steps = [
    {
      title: "Definí tu identidad",
      description: "Colores, tono y propuesta de valor.",
      icon: Palette,
      tab: "brandkit",
      done: Boolean(c.currentBrand.valueProposition),
    },
    {
      title: "Encontrá tu próxima idea",
      description: "Explorá conceptos y mensajes con IA.",
      icon: Sparkles,
      tab: "creative",
      done: c.creativeConcepts.length > 0,
    },
    {
      title: "Dale forma al contenido",
      description: "Diseñá una pieza con tu propia marca.",
      icon: Layers3,
      tab: "composer",
      done: Boolean(c.generatedImage),
    },
  ] as const;
  if (c.scheduleLoadError)
    return (
      <div role="alert" className="hub-alert">
        <AlertCircle size={20} />
        <span>
          No pudimos leer el calendario. Tus publicaciones guardadas se
          conservan.
        </span>
        <button
          className="hub-text-button"
          onClick={() => c.fetchScheduledPosts()}
        >
          Reintentar
        </button>
      </div>
    );
  if (!c.scheduleLoaded)
    return (
      <div className="hub-loading" role="status">
        <span className="hub-spinner" />
        Cargando tu actividad…
      </div>
    );
  return (
    <div className="hub-overview">
      <section className="hub-stats" aria-label="Actividad de la marca">
        {stats.map((stat) => (
          <div className="hub-stat" key={stat.label}>
            <div className="hub-stat-top">
              <span>{stat.label}</span>
              <stat.icon size={18} className={`hub-${stat.color}`} />
            </div>
            <strong>{stat.value.toString().padStart(2, "0")}</strong>
            <p>{stat.detail}</p>
          </div>
        ))}
      </section>
      {failed.length > 0 && (
        <button className="hub-alert" onClick={() => onNavigate("publish")}>
          <AlertCircle size={18} />
          <span>
            {failed.length} publicación
            {failed.length > 1 ? "es requieren" : " requiere"} revisión. Abrí el
            calendario para ver el motivo.
          </span>
          <ArrowRight size={16} />
        </button>
      )}
      {overdue.length > 0 && (
        <button className="hub-alert" onClick={() => onNavigate("publish")}>
          <Clock3 size={18} />
          <span>
            {overdue.length} publicaciones tienen una fecha pasada y su
            resultado aún no está confirmado. Revisá su estado en el calendario.
          </span>
          <ArrowRight size={16} />
        </button>
      )}
      <div className="hub-overview-grid">
        <section className="hub-panel">
          <div className="hub-panel-heading">
            <div>
              <span className="hub-eyebrow">PLANIFICACIÓN</span>
              <h2>Tu calendario</h2>
            </div>
            <button
              className="hub-text-button"
              onClick={() => onNavigate("publish")}
            >
              Ver todo <ArrowRight size={15} />
            </button>
          </div>
          {next.length ? (
            <div className="hub-post-list">
              {next.map((post) => (
                <button
                  className="hub-post-row"
                  key={post.id}
                  onClick={() => onNavigate("publish")}
                >
                  <div className="hub-post-icon">
                    {post.imagePath ? (
                      <img src={post.imagePath} alt="" />
                    ) : (
                      <CalendarDays size={22} />
                    )}
                  </div>
                  <div>
                    <span className="hub-post-title">{post.message}</span>
                    <span className="hub-post-date">
                      <Clock3 size={12} />
                      {formatDate(post.scheduledAt)}
                    </span>
                  </div>
                  <span className="hub-pill">
                    {Date.parse(post.scheduledAt) < now - 300000
                      ? "Por confirmar"
                      : post.fbScheduled
                        ? "En Facebook"
                        : "En cola local"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="hub-empty">
              <div className="hub-empty-calendar">
                <CalendarDays size={30} />
                <span>+</span>
              </div>
              <h3>Hay espacio para tu próxima idea</h3>
              <p>
                Programá tu primer contenido y empezá a construir una presencia
                constante.
              </p>
              <button
                className="hub-button hub-button-secondary"
                onClick={() => onNavigate("creative")}
              >
                Crear contenido en Estudio Creativo <ArrowRight size={16} />
              </button>
            </div>
          )}
          <div className="hub-panel-footnote">
            <Clock3 size={14} /> Las publicaciones de la cola local necesitan
            este equipo encendido.
          </div>
        </section>
        <section className="hub-panel hub-start-panel">
          <span className="hub-eyebrow">DE LA IDEA A LA PUBLICACIÓN</span>
          <h2>Tu siguiente paso</h2>
          <p className="hub-panel-description">
            Un flujo simple para crear mejor contenido.
          </p>
          <div className="hub-steps">
            {steps.map((step, index) => (
              <button key={step.tab} onClick={() => onNavigate(step.tab)}>
                <span
                  className={`hub-step-number ${step.done ? "is-done" : ""}`}
                >
                  {step.done ? <Check size={16} /> : `0${index + 1}`}
                </span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <section
        className="hub-quick-actions"
        aria-label="Herramientas creativas"
      >
        <button onClick={() => onNavigate("image")}>
          <div className="hub-tool-icon hub-blue">
            <Image size={22} />
          </div>
          <div>
            <h3>Creá algo que se vea bien</h3>
            <p>Imágenes y video con IA, listos para tu diseño.</p>
          </div>
          <ArrowRight size={19} />
        </button>
        <button
          onClick={() => {
            c.setActiveSection("neurocortex-b2b");
          }}
        >
          <div className="hub-tool-icon hub-mint">
            <Sparkles size={22} />
          </div>
          <div>
            <h3>Convertí oportunidades en clientes</h3>
            <p>Prospección y demos web con {c.currentBrand?.name || "tu marca"}.</p>
          </div>
          <ArrowRight size={19} />
        </button>
      </section>
      <section className="hub-connections">
        <div>
          <h2>Conexiones del espacio</h2>
          <p>Disponibilidad actual de tus herramientas.</p>
        </div>
        <div className="hub-connection-items">
          <span>
            <i className={page?.connected ? "is-online" : ""} />
            Facebook{" "}
            <small>{page?.connected ? "Configurado" : "Sin configurar"}</small>
          </span>
          <span>
            <i className={c.comfyuiActive ? "is-online" : ""} />
            ComfyUI{" "}
            <small>
              {c.comfyuiActive === null
                ? "Consultando"
                : c.comfyuiActive
                  ? "Disponible"
                  : "Apagado"}
            </small>
          </span>
          <span>
            <i className={c.canvaConnected ? "is-online" : ""} />
            Canva{" "}
            <small>
              {c.canvaConnected === null
                ? "Consultando"
                : c.canvaConnected
                  ? "Configurado"
                  : "Sin conectar"}
            </small>
          </span>
        </div>
        <button
          className="hub-text-button"
          onClick={() => c.setShowLlmModal(true)}
        >
          Configurar <ArrowRight size={15} />
        </button>
      </section>
    </div>
  );
}
