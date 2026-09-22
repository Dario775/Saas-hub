"use client";

import {
ArrowUpRight,
ChevronRight,
Cpu,
Image,
Layers3,
LayoutDashboard,
Menu,
Palette,
Plus,
Send,
Sparkles,
Users,
X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { TabId } from "./config";
import { useWorkspace } from "./hooks/use-workspace";
import { Overview } from "./views/Overview";

const loading = () => (
  <div className="hub-loading" role="status">
    <span className="hub-spinner" /> Preparando tu espacio…
  </div>
);
const BrandKitView = dynamic(() => import("./views/BrandKitView"), { loading });
const CreativeView = dynamic(() => import("./views/CreativeView"), { loading });
const ImageView = dynamic(() => import("./views/ImageView"), { loading });
const ComposerView = dynamic(() => import("./views/ComposerView"), { loading });
const PublishView = dynamic(() => import("./views/PublishView"), { loading });
const AISettingsModal = dynamic(() => import("./views/AISettingsModal"));
const ConnectPageModal = dynamic(() => import("./views/ConnectPageModal"));
const ImageLightbox = dynamic(() => import("./views/ImageLightbox"));
const LeadsView = dynamic(
  () => import("@/components/leads/LeadsView").then((m) => m.LeadsView),
  { loading },
);

const navigation = [
  {
    id: "overview",
    title: "Resumen",
    icon: LayoutDashboard,
    description: "Tu operación, en un solo lugar.",
  },
  {
    id: "creative",
    title: "Estudio creativo",
    icon: Sparkles,
    description: "De una idea a una propuesta que conecta con tu audiencia.",
  },
  {
    id: "image",
    title: "Imágenes y video",
    icon: Image,
    description: "Creá los recursos visuales de tu próxima publicación.",
  },
  {
    id: "composer",
    title: "Editor de diseño",
    icon: Layers3,
    description:
      "Combiná imágenes, textos e identidad en una pieza lista para compartir.",
  },
  {
    id: "publish",
    title: "Publicaciones",
    icon: Send,
    description: "Revisá, publicá y organizá tu calendario de Facebook.",
  },
  {
    id: "brandkit",
    title: "Identidad de marca",
    icon: Palette,
    description:
      "Una voz y una identidad visual consistentes en cada contenido.",
  },
] as const;

export default function Workspace() {
  const controller = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    tab,
    setTab,
    activeSection,
    setActiveSection,
    pages,
    pageId,
    setPageId,
    currentBrand,
  } = controller;
  const isSales = activeSection === "neurocortex-b2b";
  const active = navigation.find((item) => item.id === tab) || navigation[0];
  function navigate(id: TabId) {
    setTab(id);
    setActiveSection("workspace");
    setMenuOpen(false);
  }
  const title = isSales ? "Clientes y oportunidades" : active.title;

  return (
    <div className="hub-workspace">
      <a className="hub-skip" href="#workspace-content">
        Ir al contenido
      </a>
      {menuOpen && (
        <button
          className="hub-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`hub-sidebar ${menuOpen ? "is-open" : ""}`}
        aria-label="Navegación principal"
      >
        <div className="hub-wordmark">
          <div className="hub-logo">
            <Layers3 size={21} />
          </div>
          <span>
            saas<span className="hub-wordmark-light">hub</span>
            <small>ESTUDIO DE OPERACIONES</small>
          </span>
          <button
            className="hub-mobile-close"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="hub-workspace-select">
          <label htmlFor="active-brand">ESPACIO DE TRABAJO</label>
          <select
            id="active-brand"
            value={pageId}
            onChange={(event) => {
              setPageId(event.target.value);
              setActiveSection("workspace");
            }}
          >
            {!pageId && <option value="">Elegí una marca</option>}
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
          <span>
            {pages.find((page) => page.id === pageId)?.connected
              ? "Página de Facebook configurada"
              : "Configurá tu página para publicar"}
          </span>
        </div>
        <nav className="hub-nav">
          <p>CONTENIDO</p>
          {navigation
            .filter((item) => item.id !== "brandkit")
            .map((item) => (
              <button
                key={item.id}
                className={!isSales && tab === item.id ? "is-active" : ""}
                aria-current={!isSales && tab === item.id ? "page" : undefined}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={18} />
                <span>{item.title}</span>
                {!isSales && tab === item.id && <span className="hub-nav-dot" />}
              </button>
            ))}
          <p>NEGOCIO</p>
          <button
            className={isSales ? "is-active" : ""}
            aria-current={isSales ? "page" : undefined}
            onClick={() => {
              setActiveSection("neurocortex-b2b");
              setMenuOpen(false);
            }}
          >
            <Users size={18} />
            <span>Clientes y oportunidades</span>
            {isSales && <span className="hub-nav-dot" />}
          </button>
          <button
            className={!isSales && tab === "brandkit" ? "is-active" : ""}
            aria-current={!isSales && tab === "brandkit" ? "page" : undefined}
            onClick={() => navigate("brandkit")}
          >
            <Palette size={18} />
            <span>Identidad de marca</span>
            {!isSales && tab === "brandkit" && <span className="hub-nav-dot" />}
          </button>
        </nav>
        <div className="hub-sidebar-bottom">
          <button onClick={() => controller.setShowConnectModal(true)}>
            <Plus size={17} /> Conectar página
          </button>
          <button onClick={() => controller.setShowLlmModal(true)}>
            <Cpu size={17} /> Configuración de IA
          </button>
          <div className="hub-sidebar-note">
            <span className="hub-status-dot" /> Espacio local <span>·</span>{" "}
            Guardado en este equipo
          </div>
        </div>
      </aside>
      <div className="hub-main">
        <header className="hub-topbar">
          <div className="hub-breadcrumb">
            <button
              className="hub-menu-button"
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>
              {currentBrand.name || "Tu espacio"}
            </span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <button
            className="hub-topbar-action"
            aria-label="Nueva publicación"
            onClick={() => navigate("publish")}
          >
            <Plus size={16} />
            <span>Nueva publicación</span>
          </button>
        </header>
        <main id="workspace-content" tabIndex={-1} className="hub-content">
          <div className="hub-page-heading">
            <div>
              <div className="hub-eyebrow">
                {isSales ? "DESARROLLO COMERCIAL" : "TU ESPACIO DE TRABAJO"}
              </div>
              <h1>{title}</h1>
              <p>
                {isSales
                  ? "Encontrá comercios, prepará una demo y acompañá cada oportunidad hasta el cierre."
                  : active.description}
              </p>
            </div>
            {!isSales && tab === "overview" && (
              <button
                className="hub-button hub-button-primary"
                onClick={() => navigate("creative")}
              >
                Crear contenido <ArrowUpRight size={17} />
              </button>
            )}
          </div>
          {isSales ? (
            <LeadsView brandContext={controller.currentBrand} />
          ) : (
            <>
              {tab === "overview" && (
                <Overview controller={controller} onNavigate={navigate} />
              )}
              {tab === "brandkit" && (
                <>
                  <div className="hub-view-actions">
                    <button
                      className="hub-button hub-button-primary"
                      disabled={!controller.draftBrand}
                      onClick={() =>
                        controller.draftBrand &&
                        controller.handleUpdateBrand(controller.draftBrand)
                      }
                    >
                      Guardar identidad
                    </button>
                  </div>
                  <BrandKitView controller={controller} />
                </>
              )}
              {tab === "creative" && <CreativeView controller={controller} />}
              {tab === "image" && <ImageView controller={controller} />}
              {tab === "composer" && (
                <ComposerView key={currentBrand.id} controller={controller} />
              )}
              {tab === "publish" && <PublishView controller={controller} />}
            </>
          )}
        </main>
        <footer className="hub-footer">
          <span>
            SaaS Hub · {currentBrand.name || "Tu espacio"}
          </span>
          <span>Creá con intención. Publicá con claridad.</span>
        </footer>
      </div>
      {controller.showLlmModal && <AISettingsModal controller={controller} />}
      {controller.showConnectModal && (
        <ConnectPageModal controller={controller} />
      )}
      {controller.showImageLightbox && (
        <ImageLightbox controller={controller} />
      )}
    </div>
  );
}
