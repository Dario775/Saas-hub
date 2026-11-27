"use client";
import type { ConceptCopy } from "@/components/composer/concept-layers";
import type { ComposerDesign } from "@/components/composer/flyer-design";
import { CLAUDE_DEFAULT_MODEL } from "@/lib/claude-models";
import { renderSizeForAspect } from "@/lib/render-sizes";
import type { ScheduledPost } from "@/lib/schedule-types";
/* eslint-disable react-hooks/set-state-in-effect -- Hydrate stored workspace preferences and synchronize external brand selection. */
import {
BRAND_LOGOS,
DEFAULT_BRANDS,
INITIAL_PAGES,
type BrandConfig,
} from "@/features/workspace/config";
import {
GENERATORS,
buildRichPrompt,
type ImageGenerator,
} from "@/lib/generators";
import { FacebookPage } from "@/lib/pages";
import { useEffect,useState } from "react";
import { toast } from "sonner";
import { useNavigation } from "./use-navigation";
import { usePublishDraft } from "./use-publish-draft";
export function useWorkspace() {
  const { tab, setTab, activeSection, setActiveSection, pageId, setPageId } =
    useNavigation();

  // Publish & Workspaces
  const [pages, setPages] = useState<FacebookPage[]>(INITIAL_PAGES);
  const {
    message,
    setMessage,
    generatedImage,
    generatedVideo,
    setGeneratedImage,
    setGeneratedVideo,
    draftSource,
    setDraftSource,
  } = usePublishDraft(pageId);
  const [loading, setLoading] = useState(false);

  // Modal Conectar Página de Facebook
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [connectingPage, setConnectingPage] = useState<boolean>(false);
  const [inspectingToken, setInspectingToken] = useState<boolean>(false);
  const [newPageName, setNewPageName] = useState<string>("");
  const [newPageCategory, setNewPageCategory] = useState<string>("");
  const [newPageEmoji, setNewPageEmoji] = useState<string>("📄");
  const [newPageId, setNewPageId] = useState<string>("");
  const [newPageToken, setNewPageToken] = useState<string>("");
  const [newPageTestConnection, setNewPageTestConnection] =
    useState<boolean>(true);
  const [showTokenPlain, setShowTokenPlain] = useState<boolean>(false);

  const fetchPages = async () => {
    try {
      const res = await fetch("/api/pages");
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.pages)) {
          setPages(data.pages);
          if (data.pages.length > 0) {
            const exists = data.pages.some((p: any) => p.id === pageId);
            if (!pageId || !exists) {
              const savedBrand =
                typeof window !== "undefined"
                  ? localStorage.getItem("saashub_selected_page")
                  : null;
              const validSaved = data.pages.find((p: any) => p.id === savedBrand);
              setPageId(validSaved ? validSaved.id : data.pages[0].id);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error al cargar páginas:", err);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleInspectToken = async (tokenToTest?: string) => {
    const token = tokenToTest || newPageToken;
    if (!token?.trim()) {
      toast.error(
        "Pega primero el Page Access Token para auto-detectar los datos",
      );
      return;
    }
    setInspectingToken(true);
    try {
      const res = await fetch("/api/pages/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "No se pudo validar el token con Facebook",
        );
      }

      if (data.type === "page") {
        if (data.name) setNewPageName(data.name);
        if (data.pageId) setNewPageId(data.pageId);
        if (data.category) setNewPageCategory(data.category);
        toast.success(`¡Página detectada: ${data.name}!`, {
          description: `Page ID canónico: ${data.pageId} (${data.category})`,
        });
      } else if (data.type === "user" && data.pages?.length > 0) {
        const first = data.pages[0];
        setNewPageName(first.name);
        setNewPageId(first.id);
        setNewPageCategory(first.category);
        if (first.accessToken) setNewPageToken(first.accessToken);
        toast.success(`Página seleccionada: ${first.name}`, {
          description: `Se detectaron ${data.pages.length} páginas administradas.`,
        });
      }
    } catch (err: any) {
      toast.error("Error al detectar página", { description: err.message });
    } finally {
      setInspectingToken(false);
    }
  };

  const handleConnectPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageToken.trim()) {
      toast.error("Por favor ingresa el Token de Acceso (Page Access Token)");
      return;
    }

    setConnectingPage(true);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPageName,
          category: newPageCategory,
          emoji: newPageEmoji,
          pageId: newPageId,
          accessToken: newPageToken,
          testConnection: newPageTestConnection,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo conectar la página");
      }

      toast.success("¡Página conectada con éxito!", {
        description:
          data.message ||
          `La página "${data.page?.name || newPageName}" está lista para usarse.`,
      });

      await fetchPages();
      if (data.page?.id) {
        setPageId(data.page.id);
      }

      setNewPageName("");
      setNewPageCategory("");
      setNewPageEmoji("📄");
      setNewPageId("");
      setNewPageToken("");
      setShowConnectModal(false);
    } catch (err: any) {
      toast.error("Error al conectar página", {
        description: err.message || String(err),
      });
    } finally {
      setConnectingPage(false);
    }
  };

  const handleDeletePage = async (idToDelete: string) => {
    if (!confirm("¿Estás seguro de que deseas desconectar esta página?"))
      return;
    try {
      const res = await fetch(
        `/api/pages?id=${encodeURIComponent(idToDelete)}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar la página");
      }
      toast.success("Página desconectada");
      if (pageId === idToDelete) {
        setPageId("");
      }
      await fetchPages();
    } catch (err: any) {
      toast.error("Error al eliminar página", { description: err.message });
    }
  };

  // Imagen
  const [imageSubject, setImageSubject] = useState(""); // sujeto principal
  const [imageText, setImageText] = useState(""); // texto en la imagen
  const [imageStyle, setImageStyle] = useState("ninguno"); // estilo artístico
  const [imageDetails, setImageDetails] = useState(""); // detalles adicionales
  const [imageNegative, setImageNegative] = useState(""); // prompt negativo
  const [composerInitialImage, setComposerInitialImage] = useState<
    string | null
  >(null);
  const [composerInitialCopy, setComposerInitialCopy] =
    useState<ConceptCopy | null>(null);
  const [composerInitialDesign, setComposerInitialDesign] =
    useState<ComposerDesign | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [selectedGenerator, setSelectedGenerator] =
    useState<ImageGenerator>("z-image-turbo");
  const [genParams, setGenParams] = useState<Record<string, number | string>>(
    {},
  );

  // Auto-completar desde URL
  const [extractUrl, setExtractUrl] = useState("");
  const [extracting, setExtracting] = useState(false);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "facebook",
  ]);

  // Canva and Video integration states
  const [imageSource, setImageSource] = useState<
    "comfyui" | "gemini" | "openai" | "canva" | "wan-video"
  >("comfyui");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiEnvKeySet, setOpenaiEnvKeySet] = useState<boolean>(false);
  const [geminiEnvKeySet, setGeminiEnvKeySet] = useState<boolean>(false);
  const [canvaConnected, setCanvaConnected] = useState<boolean | null>(null); // null = cargando
  const [canvaDesigns, setCanvaDesigns] = useState<any[]>([]);
  const [canvaLoading, setCanvaLoading] = useState<boolean>(false);
  const [canvaSearchQuery, setCanvaSearchQuery] = useState<string>("");
  const [importingCanvaId, setImportingCanvaId] = useState<string | null>(null);
  const [selectedCanvaDesignId, setSelectedCanvaDesignId] = useState<
    string | null
  >(null);
  const [canvaPrompt, setCanvaPrompt] = useState<string>("");
  const [editingWithAi, setEditingWithAi] = useState<boolean>(false);
  const [creatingCanva, setCreatingCanva] = useState<boolean>(false);

  // Estados para Generación de Video Wan 2.2 14B T2V (ComfyUI)
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoNegativePrompt, setVideoNegativePrompt] = useState("");
  const [videoAspectRatio, setVideoAspectRatio] = useState<
    "9:16" | "1:1" | "16:9"
  >("9:16");
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [videoLightning, setVideoLightning] = useState<boolean>(true);
  const [videoElapsed, setVideoElapsed] = useState<string | null>(null);

  // States for template-based flyer creation
  const [templateDesignIdForCreation, setTemplateDesignIdForCreation] =
    useState<string | null>(null);
  const [templateDesignTitleForCreation, setTemplateDesignTitleForCreation] =
    useState<string | null>(null);
  const [creationPrompt, setCreationPrompt] = useState<string>("");
  const [creatingFromTemplate, setCreatingFromTemplate] =
    useState<boolean>(false);

  // Layout, Daily variation, and Aspect Ratio States
  const [textLayout, setTextLayout] = useState<string>("ninguno");
  const [textStylePreset, setTextStylePreset] =
    useState<string>("modern-white");
  const [imageSubtitle, setImageSubtitle] = useState<string>("");
  const [imageSubtitleStyle, setImageSubtitleStyle] =
    useState<string>("clean-white");
  const [imageBullets, setImageBullets] = useState<string>("");
  const [dailyVariation, setDailyVariation] = useState<string>("ninguno");
  const [aspectRatioPreset, setAspectRatioPreset] = useState<string>("1:1");
  const [quickIdea, setQuickIdea] = useState<string>("");
  const [expandingIdea, setExpandingIdea] = useState<boolean>(false);
  const [selectedLogo, setSelectedLogo] = useState<string>("ninguno");
  const [logoPosition, setLogoPosition] = useState<string>("bottom_right");
  const [applyingBrand, setApplyingBrand] = useState<boolean>(false);
  const [generatingCaption, setGeneratingCaption] = useState<boolean>(false);

  // Brand Configuration states
  const [brands, setBrands] = useState<BrandConfig[]>([]);
  const [draftBrand, setDraftBrand] = useState<BrandConfig | null>(null);

  // Sync draftBrand when changing pageId or opening brandkit
  useEffect(() => {
    if (pageId && tab === "brandkit") {
      const existing = brands.find((b) => b.id === pageId);
      setDraftBrand(
        existing || {
          id: pageId,
          name: pages.find((p) => p.id === pageId)?.name || "",
          logoPreset: "ninguno" as const,
          colors: { primary: ["#ffffff"], secondary: ["#888888"] },
          typography: { heading: "Inter", body: "Inter" },
          styleAspects: "",
          brandGuidelines: "",
          voiceTone: "",
        },
      );
    }
  }, [pageId, tab]);

  // AI Settings states
  const [llmProvider, setLlmProvider] = useState<
    "openrouter" | "ollama" | "gemini" | "openai" | "deepseek" | "claude"
  >("ollama");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState(
    "google/gemini-2.5-flash:free",
  );
  const [ollamaUrl, setOllamaUrl] = useState("http://127.0.0.1:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [deepseekModel, setDeepseekModel] = useState("deepseek-flash");
  const [deepseekEnvKeySet, setDeepseekEnvKeySet] = useState<boolean>(false);
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [claudeModel, setClaudeModel] = useState(CLAUDE_DEFAULT_MODEL);
  const [claudeEnvKeySet, setClaudeEnvKeySet] = useState<boolean>(false);
  const [jevApiKey, setJevApiKey] = useState("");
  const [jevEnvKeySet, setJevEnvKeySet] = useState<boolean>(false);
  const [showLlmModal, setShowLlmModal] = useState(false);
  const [showImageLightbox, setShowImageLightbox] = useState(false);

  const llmSettings = {
    provider: llmProvider,
    openrouterKey,
    openrouterModel,
    ollamaUrl,
    ollamaModel,
    geminiApiKey,
    geminiModel,
    openaiApiKey,
    openaiModel: "gpt-4o-mini",
    deepseekApiKey,
    deepseekModel,
    claudeApiKey,
    claudeModel,
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const legacy = {
          openrouterKey: localStorage.getItem("saashub_openrouter_key"),
          geminiApiKey: localStorage.getItem("saashub_gemini_api_key"),
          openaiApiKey: localStorage.getItem("saashub_openai_api_key"),
        };
        if (Object.values(legacy).some(Boolean)) {
          const response = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              migrate: true,
              ...Object.fromEntries(
                Object.entries(legacy).filter(([, value]) => value),
              ),
            }),
          });
          if (response.ok)
            [
              "saashub_openrouter_key",
              "saashub_gemini_api_key",
              "saashub_openai_api_key",
            ].forEach((key) => localStorage.removeItem(key));
        }
        const response = await fetch("/api/settings");
        const { settings } = await response.json();
        if (!response.ok || !settings) return;
        if (settings.provider) setLlmProvider(settings.provider);
        if (settings.openrouterModel)
          setOpenrouterModel(settings.openrouterModel);
        if (settings.ollamaUrl) setOllamaUrl(settings.ollamaUrl);
        if (settings.ollamaModel) setOllamaModel(settings.ollamaModel);
        if (settings.geminiModel) setGeminiModel(settings.geminiModel);
        if (settings.deepseekModel) setDeepseekModel(settings.deepseekModel);
        if (settings.claudeModel) setClaudeModel(settings.claudeModel);
        setClaudeEnvKeySet(Boolean(settings.claudeKeyConfigured));
        setOpenaiEnvKeySet(Boolean(settings.openaiApiKeyConfigured));
        setGeminiEnvKeySet(Boolean(settings.geminiApiKeyConfigured));
        setDeepseekEnvKeySet(Boolean(settings.deepseekKeyConfigured));
        setJevEnvKeySet(Boolean(settings.jevKeyConfigured));
      } catch {
        toast.error("No se pudo cargar la configuración de IA.");
      }
    }
    void loadSettings();

    // Cargar marcas de saashub_brands
    const savedBrands = localStorage.getItem("saashub_brands");
    if (savedBrands) {
      try {
        const parsed = JSON.parse(savedBrands);
        // Migración automática para datos viejos
        const migrated = parsed.map((b: any) => {
          if (typeof b.colors === "string" || !b.colors?.primary) {
            return {
              ...b,
              colors: {
                primary: ["#0f172a", "#3b82f6"],
                secondary: ["#94a3b8"],
              },
              typography: {
                heading:
                  typeof b.typography === "string"
                    ? b.typography.split("/")[0].trim()
                    : "Montserrat",
                body: "Inter",
              },
              brandGuidelines: b.styleAspects || "",
              voiceTone: "",
            };
          }
          return b;
        });
        setBrands(migrated);
        localStorage.setItem("saashub_brands", JSON.stringify(migrated));
      } catch (e) {
        setBrands(DEFAULT_BRANDS);
      }
    } else {
      setBrands(DEFAULT_BRANDS);
      localStorage.setItem("saashub_brands", JSON.stringify(DEFAULT_BRANDS));
    }
    async function syncBrands() {
      try {
        const response = await fetch("/api/brands");
        if (!response.ok)
          throw new Error("No se pudo leer la identidad guardada.");
        const data = await response.json();
        if (data.brands.length) {
          setBrands(data.brands);
          return;
        }
        const local =
          JSON.parse(localStorage.getItem("saashub_brands") || "null") ||
          DEFAULT_BRANDS;
        const saved = await fetch("/api/brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ migrate: true, brands: local }),
        });
        const result = await saved.json();
        if (!saved.ok)
          throw new Error(result.error || "No se pudo guardar la identidad en este equipo.");
        setBrands(result.brands);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo sincronizar la identidad.",
        );
      }
    }
    void syncBrands();
  }, []);

  // Sincronizar generador por defecto según canal
  useEffect(() => {
    if (
      imageSource === "comfyui" &&
      (selectedGenerator.startsWith("gemini-") ||
        selectedGenerator.startsWith("dall-e-"))
    ) {
      setSelectedGenerator("z-image-turbo");
    } else if (
      imageSource === "gemini" &&
      !selectedGenerator.startsWith("gemini-")
    ) {
      setSelectedGenerator("gemini-3.1-flash-lite-image");
    } else if (
      imageSource === "openai" &&
      !selectedGenerator.startsWith("dall-e-")
    ) {
      setSelectedGenerator("dall-e-3");
    }
  }, [imageSource, selectedGenerator]);

  async function handleSaveLlmSettings(
    provider: "openrouter" | "ollama" | "gemini" | "openai" | "deepseek" | "claude",
    key: string,
    model: string,
    url: string,
    oModel: string,
    gKey: string,
    gModel: string,
    oKey: string,
    dKey: string,
    dModel: string,
    jKey: string,
    cKey: string,
    cModel: string,
  ) {
    setLlmProvider(provider);
    setOpenrouterKey(key);
    setOpenrouterModel(model);
    setOllamaUrl(url);
    setOllamaModel(oModel);
    setGeminiApiKey(gKey);
    setGeminiModel(gModel);
    setOpenaiApiKey(oKey);
    setDeepseekApiKey(dKey);
    setDeepseekModel(dModel);
    setJevApiKey(jKey);
    setClaudeApiKey(cKey);
    setClaudeModel(cModel);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          openrouterKey: key,
          openrouterModel: model,
          ollamaUrl: url,
          ollamaModel: oModel,
          geminiApiKey: gKey,
          geminiModel: gModel,
          openaiApiKey: oKey,
          deepseekKey: dKey,
          deepseekModel: dModel,
          jevKey: jKey,
          claudeKey: cKey,
          claudeModel: cModel,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setOpenrouterKey("");
      setGeminiApiKey("");
      setOpenaiApiKey("");
      if (gKey) setGeminiEnvKeySet(true);
      if (oKey) setOpenaiEnvKeySet(true);
      setDeepseekApiKey("");
      if (dKey) setDeepseekEnvKeySet(true);
      setJevApiKey("");
      if (jKey) setJevEnvKeySet(true);
      setClaudeApiKey("");
      if (cKey) setClaudeEnvKeySet(true);
      setShowLlmModal(false);
      toast.success("Conexión guardada de forma privada en el servidor");
    } catch (error) {
      toast.error("No se pudo guardar la conexión", {
        description:
          error instanceof Error
            ? error.message
            : "Reintentá en unos segundos.",
      });
    }
  }

  // Estados para control dinámico de servicios
  const [comfyuiActive, setComfyuiActive] = useState<boolean | null>(null);
  const [canvaServerActive, setCanvaServerActive] = useState<boolean | null>(
    null,
  );
  const [serviceToggling, setServiceToggling] = useState<string | null>(null);

  const [history, setHistory] = useState<
    { page: string; message: string; status: string; time: string }[]
  >([]);

  // Estudio Creativo (pipeline multi-etapa: LLM -> router de modelos -> ComfyUI -> upscale)
  const [creativeTopic, setCreativeTopic] = useState("");
  const [creativePlatform, setCreativePlatform] = useState("instagram");
  const [creativeAspect, setCreativeAspect] = useState("1:1");
  const [creativeLanguage, setCreativeLanguage] = useState<"es" | "en">("es");
  const [creativeUpscale, setCreativeUpscale] = useState("ultrasharp");
  const [creativeLoading, setCreativeLoading] = useState(false);
  const [creativeConcepts, setCreativeConcepts] = useState<any[]>([]);
  const [creativeProgress, setCreativeProgress] = useState("");

  // Scheduling states
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [scheduleLoadError, setScheduleLoadError] = useState(false);

  // Canva integration and Scheduling functions
  useEffect(() => {
    checkCanvaStatus();
    updateServicesStatus();
    fetchScheduledPosts();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        updateServicesStatus();
        fetchScheduledPosts();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  async function fetchScheduledPosts() {
    try {
      const resp = await fetch("/api/schedule");
      const data = await resp.json();
      if (data.success) {
        setScheduledPosts(data.posts || []);
        setScheduleLoaded(true);
        setScheduleLoadError(false);
      } else {
        setScheduleLoadError(true);
      }
    } catch (err) {
      setScheduleLoadError(true);
      console.error("Error fetching scheduled posts:", err);
    }
  }

  async function handleSchedulePost() {
    if (!pageId) {
      toast.error("Elegí una página primero");
      return;
    }
    if (!message.trim()) {
      toast.error("Escribí un mensaje");
      return;
    }
    if (!scheduledTime) {
      toast.error("Seleccioná una fecha y hora");
      return;
    }

    const selectedDate = new Date(scheduledTime);
    if (selectedDate <= new Date()) {
      toast.error("La fecha de programación debe ser en el futuro");
      return;
    }

    setLoading(true);
    try {
      const body = {
        pageId,
        message,
        scheduledAt: selectedDate.toISOString(),
        image: generatedImage || undefined,
        videoUrl: generatedVideo || undefined,
        platforms: selectedPlatforms,
        source: draftSource || undefined,
      };
      const resp = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error("Error al programar", { description: data.error || "" });
        return;
      }
      toast.success("¡Publicación programada con éxito!", {
        description: `Programado para: ${selectedDate.toLocaleString()}`,
      });
      setMessage("");
      setGeneratedImage(null);
      setGeneratedVideo(null);
      setPublishMode("now");
      setScheduledTime("");
      fetchScheduledPosts();
    } catch (err) {
      toast.error("Error de conexión", { description: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSchedule(id: string) {
    try {
      const resp = await fetch(`/api/schedule?id=${id}`, {
        method: "DELETE",
      });
      const data = await resp.json();
      if (data.success) {
        toast.success("Publicación programada cancelada");
        fetchScheduledPosts();
      } else {
        toast.error("Error al cancelar la programación", {
          description: data.error || "",
        });
      }
    } catch (err) {
      toast.error("Error de red al cancelar");
    }
  }

  async function updateServicesStatus() {
    try {
      const resp = await fetch("/api/services?action=status");
      const data = await resp.json();
      if (data.success) {
        setComfyuiActive(data.services.comfyui.active);
        setCanvaServerActive(data.services.canva.active);
        setOpenaiEnvKeySet(!!data.services.openai?.envKeySet);
        setGeminiEnvKeySet(!!data.services.gemini?.envKeySet);
        return data.services;
      }
    } catch {}
    return null;
  }

  async function handleToggleService(
    service: "canva" | "comfyui",
    action: "start" | "stop",
  ) {
    setServiceToggling(service);
    try {
      const resp = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, service }),
      });
      const data = await resp.json();
      if (data.success) {
        await updateServicesStatus();
        if (service === "canva" && action === "start") {
          setTimeout(checkCanvaStatus, 1500);
        }
      } else {
        toast.error("Error al gestionar el servicio", {
          description: data.error || "",
        });
      }
    } catch (err) {
      toast.error("Error de red al gestionar el servicio");
    } finally {
      setServiceToggling(null);
    }
  }

  async function checkCanvaStatus() {
    try {
      const resp = await fetch("/api/canva?action=status");
      const data = await resp.json();
      setCanvaConnected(!!data.connected);
      if (data.connected) {
        fetchCanvaDesigns();
      }
    } catch {
      setCanvaConnected(false);
    }
  }

  async function fetchCanvaDesigns(query = "") {
    setCanvaLoading(true);
    try {
      const url = query
        ? `/api/canva?action=list&query=${encodeURIComponent(query)}`
        : "/api/canva?action=list";
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.success) {
        setCanvaDesigns(data.designs || []);
      } else {
        toast.error("Error al obtener diseños de Canva", {
          description: data.error || "",
        });
      }
    } catch (err) {
      toast.error("Error al conectar con la API de Canva");
    } finally {
      setCanvaLoading(false);
    }
  }

  async function handleImportCanvaDesign(designId: string) {
    setImportingCanvaId(designId);
    setSelectedCanvaDesignId(designId);
    try {
      const resp = await fetch(`/api/canva?action=export&designId=${designId}`);
      const data = await resp.json();
      if (!resp.ok) {
        toast.error("Error al exportar de Canva", {
          description: data.error || "No se pudo obtener la miniatura",
        });
        return;
      }
      setGeneratedImage(data.image);
      toast.success("Diseño de Canva importado con éxito");
    } catch (err) {
      toast.error("Error al conectar con la API de Canva", {
        description: String(err),
      });
    } finally {
      setImportingCanvaId(null);
    }
  }

  async function handleEditCanvaWithAi(designId: string) {
    if (!canvaPrompt.trim()) return;
    setEditingWithAi(true);
    try {
      const resp = await fetch("/api/canva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit-with-prompt",
          designId,
          brandGuidelines: currentBrand.brandGuidelines,
          projectDescription: currentBrand.projectDescription,
          colors: currentBrand.colors,
          targetAudience: currentBrand.targetAudience,
          valueProposition: currentBrand.valueProposition,
          prompt: canvaPrompt,
          llmSettings,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(data.error || "Error al editar con IA en Canva", {
          description: data.detail || "La edición de Canva falló",
        });
        return;
      }
      setCanvaPrompt("");
      toast.success("Diseño editado con éxito");
      // Re-importar para descargar la miniatura actualizada
      await handleImportCanvaDesign(designId);
    } catch (err) {
      toast.error("Error al procesar la edición", { description: String(err) });
    } finally {
      setEditingWithAi(false);
    }
  }

  async function handleCreateCanvaDesign() {
    setCreatingCanva(true);
    try {
      const resp = await fetch("/api/canva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: "Publicación Canva IA",
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error("Error al crear diseño", {
          description: data.error || "No se pudo crear en Canva",
        });
        return;
      }
      toast.success("Diseño editable con IA creado");
      // Recargar diseños para mostrar el nuevo
      await fetchCanvaDesigns(canvaSearchQuery);
    } catch (err) {
      toast.error("Error de conexión", { description: String(err) });
    } finally {
      setCreatingCanva(false);
    }
  }

  async function handleCreateFlyerFromTemplate() {
    if (!templateDesignIdForCreation || !creationPrompt.trim()) return;
    setCreatingFromTemplate(true);
    try {
      const newTitle = `Flyer IA - ${templateDesignTitleForCreation}`;
      const createResp = await fetch("/api/canva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: newTitle,
          templateDesignId: templateDesignIdForCreation,
        }),
      });
      const createData = await createResp.json();
      if (!createResp.ok) {
        toast.error("Error al duplicar la plantilla", {
          description: createData.error || "",
        });
        return;
      }

      const newDesignId = createData.designId;
      const editUrl = createData.editUrl;

      toast.success("Plantilla duplicada con éxito. Modificando con IA...");

      const editResp = await fetch("/api/canva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit-with-prompt",
          designId: newDesignId,
          prompt: creationPrompt,
          llmSettings,
        }),
      });
      const editData = await editResp.json();
      if (!editResp.ok) {
        toast.error("Error al aplicar la IA al nuevo diseño", {
          description: editData.error || "",
        });
        return;
      }

      toast.success("¡Tu nuevo flyer ha sido creado y editado con IA!");
      setCreationPrompt("");
      setTemplateDesignIdForCreation(null);
      setTemplateDesignTitleForCreation(null);

      if (editUrl) {
        window.open(editUrl, "_blank");
      }

      await fetchCanvaDesigns(canvaSearchQuery);
      await handleImportCanvaDesign(newDesignId);
    } catch (err: any) {
      toast.error("Error al procesar la creación del flyer", {
        description: err.message,
      });
    } finally {
      setCreatingFromTemplate(false);
    }
  }

  function getInitialParams(genId: ImageGenerator) {
    return { ...GENERATORS[genId].defaultParams };
  }

  async function handleGenerateImage() {
    // Buscar la marca correspondiente para el reemplazo de placeholders
    const activeBrand = brands.find((b) => b.id === selectedLogo) || brands[0];
    const brandName = activeBrand ? activeBrand.name : "SaaS";

    // Reemplazar marcadores comunes [Nombre del software], [Nombre de la marca], [marca], [producto]
    const cleanSubject = imageSubject.replace(
      /\[(nombre del software|nombre de la marca|marca|producto)\]/gi,
      brandName,
    );
    const cleanText = imageText.replace(
      /\[(nombre del software|nombre de la marca|marca|producto)\]/gi,
      brandName,
    );
    const cleanDetails = imageDetails.replace(
      /\[(nombre del software|nombre de la marca|marca|producto)\]/gi,
      brandName,
    );
    const cleanSubtitle = imageSubtitle.replace(
      /\[(nombre del software|nombre de la marca|marca|producto)\]/gi,
      brandName,
    );
    const cleanBullets = imageBullets.replace(
      /\[(nombre del software|nombre de la marca|marca|producto)\]/gi,
      brandName,
    );

    // Actualizar los inputs de la interfaz para que el usuario vea la corrección
    if (cleanSubject !== imageSubject) setImageSubject(cleanSubject);
    if (cleanText !== imageText) setImageText(cleanText);
    if (cleanDetails !== imageDetails) setImageDetails(cleanDetails);
    if (cleanSubtitle !== imageSubtitle) setImageSubtitle(cleanSubtitle);
    if (cleanBullets !== imageBullets) setImageBullets(cleanBullets);

    const prompt = buildRichPrompt(
      cleanSubject,
      cleanText,
      imageStyle,
      cleanDetails,
      textLayout,
      dailyVariation,
      textStylePreset,
      cleanSubtitle,
      imageSubtitleStyle,
      cleanBullets,
      {
        name: currentBrand.name,
        guidelines: currentBrand.brandGuidelines,
        voiceTone: currentBrand.voiceTone,
        colors: currentBrand.colors,
        typography: currentBrand.typography,
        projectDescription: currentBrand.projectDescription,
      },
      selectedGenerator,
    );
    if (!cleanSubject.trim()) {
      toast.error("Escribí el sujeto principal de la imagen");
      return;
    }
    setImageLoading(true);
    setGeneratedImage(null);
    try {
      const gen = GENERATORS[selectedGenerator];
      const params = { ...gen.defaultParams, ...genParams };
      const resp = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negativePrompt: imageNegative.trim() || undefined,
          generator: selectedGenerator,
          imageSubject: cleanSubject.trim(),
          imageText: cleanText.trim(),
          imageStyle,
          imageDetails: cleanDetails.trim(),
          textLayout,
          dailyVariation,
          textStylePreset,
          imageSubtitle: cleanSubtitle.trim(),
          imageSubtitleStyle,
          imageBullets: cleanBullets.trim(),
          llmSettings,
          brand: {
            name: currentBrand.name,
            brandGuidelines: currentBrand.brandGuidelines,
            voiceTone: currentBrand.voiceTone,
            colors: currentBrand.colors,
            typography: currentBrand.typography,
            projectDescription: currentBrand.projectDescription,
            targetAudience: currentBrand.targetAudience,
            valueProposition: currentBrand.valueProposition,
            styleAspects: currentBrand.styleAspects,
          },
          geminiApiKey: geminiApiKey || undefined,
          openaiApiKey: openaiApiKey || undefined,
          ...params,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error("Error al generar imagen", {
          description: data.error || "Verificá que ComfyUI esté corriendo",
        });
        return;
      }
      setGeneratedImage(data.image);
      toast.success("Imagen generada", {
        description: `${data.generator_name} · ${data.elapsed}`,
      });
    } catch (err) {
      toast.error("No se pudo conectar con ComfyUI", {
        description: String(err),
      });
    } finally {
      setImageLoading(false);
    }
  }

  // Generación de Video Wan 2.2 14B T2V (ComfyUI)
  async function handleGenerateVideo() {
    if (!videoPrompt.trim()) {
      toast.error("Escribí una descripción o prompt para el video");
      return;
    }
    setVideoLoading(true);
    setGeneratedVideo(null);
    setVideoElapsed(null);
    try {
      const resp = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPrompt.trim(),
          negativePrompt: videoNegativePrompt.trim() || undefined,
          aspectRatio: videoAspectRatio,
          duration: videoDuration,
          fps: 16,
          lightning: videoLightning,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error("Error al generar video", {
          description: data.detail || data.error || "ComfyUI falló",
        });
        return;
      }
      setGeneratedVideo(data.videoUrl);
      setVideoElapsed(data.elapsed);
      toast.success("¡Video generado con éxito!", {
        description: `${data.generator_name} · ${data.elapsed}`,
      });
    } catch (err: any) {
      toast.error("No se pudo conectar con ComfyUI", {
        description: String(err?.message || err),
      });
    } finally {
      setVideoLoading(false);
    }
  }

  // Pipeline Estudio Creativo: LLM (conceptos) -> router de modelos -> ComfyUI -> upscale
  async function handleGenerateConcepts() {
    if (!creativeTopic.trim()) {
      toast.error("Escribí el tema de la campaña");
      return;
    }
    setCreativeLoading(true);
    setCreativeConcepts([]);
    setCreativeProgress("Dirigiendo creativo: generando conceptos con IA...");
    const currentBrand =
      brands.find((b) => b.id === pageId) || draftBrand || brands[0];
    try {
      const resp = await fetch("/api/creative-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: creativeTopic.trim(),
          platform: creativePlatform,
          aspectRatio: creativeAspect,
          language: creativeLanguage,
          upscale: creativeUpscale,
          llmSettings,
          brand: currentBrand
            ? {
                name: currentBrand.name,
                brandGuidelines:
                  currentBrand.brandGuidelines || currentBrand.styleAspects,
                voiceTone: currentBrand.voiceTone,
                colors: currentBrand.colors,
                typography: currentBrand.typography,
                projectDescription: currentBrand.projectDescription,
                targetAudience: currentBrand.targetAudience,
                valueProposition: currentBrand.valueProposition,
                styleAspects: currentBrand.styleAspects,
              }
            : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error("Error en Estudio Creativo", {
          description: data.error || "Verificá el LLM y ComfyUI",
        });
        return;
      }
      setCreativeConcepts(data.concepts || []);
      toast.success("¡5 Conceptos estratégicos generados!", {
        description: `Propuestas de campaña listas para ${currentBrand?.name || "tu marca"}.`,
      });
    } catch (err) {
      toast.error("Error al generar conceptos", { description: String(err) });
    } finally {
      setCreativeLoading(false);
      setCreativeProgress("");
    }
  }

  // Renderizar la imagen de un concepto individual (ComfyUI o Gemini Nube)
  const [renderingConceptIdx, setRenderingConceptIdx] = useState<number | null>(
    null,
  );
  const [renderingConceptEngine, setRenderingConceptEngine] = useState<
    "comfyui" | "gemini" | null
  >(null);

  async function handleRenderSingleConcept(
    concept: any,
    index: number,
    engine: "comfyui" | "gemini" = "comfyui",
  ) {
    setRenderingConceptIdx(index);
    setRenderingConceptEngine(engine);
    try {
      const isGemini = engine === "gemini";
      const generator = isGemini
        ? "gemini-2.5-flash"
        : concept.generator || "z-image-turbo";

      const resp = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: concept.renderPrompt || concept.visualPrompt,
          ...renderSizeForAspect(concept.aspectRatio || creativeAspect),
          negativePrompt:
            concept.negativePrompt ||
            "ugly, deformed, blurry, low resolution, bad anatomy",
          generator,
          aspectRatio: creativeAspect,
          upscale: isGemini ? "ninguno" : creativeUpscale,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(
          isGemini ? "Error al generar con Gemini" : "Error al renderizar en ComfyUI",
          {
            description:
              data.error ||
              (isGemini
                ? "Verifica tu GEMINI_API_KEY en Ajustes."
                : "Asegúrate de que ComfyUI esté encendido en Servicios."),
          },
        );
        return;
      }
      if (data.image) {
        setCreativeConcepts((prev) =>
          prev.map((c, i) =>
            i === index ? { ...c, image: data.image, error: null } : c,
          ),
        );
        toast.success(`¡Imagen generada para "${concept.conceptName}"!`, {
          description: `${data.generator_name || (isGemini ? "Gemini Imagen" : "ComfyUI")} · ${data.elapsed || "Listo"}`,
        });
      }
    } catch (err) {
      toast.error("Fallo de conexión", {
        description: String(err),
      });
    } finally {
      setRenderingConceptIdx(null);
      setRenderingConceptEngine(null);
    }
  }

  // Copiar copy del concepto al portapapeles
  function handleCopyConceptCopy(concept: any) {
    const text =
      concept.caption ||
      `${concept.headline}\n${concept.subtitle ? concept.subtitle + "\n" : ""}${concept.cta ? "\n" + concept.cta : ""}`;
    navigator.clipboard.writeText(text);
    toast.success("Copy copiado al portapapeles", {
      description: `"${concept.conceptName}"`,
    });
  }

  // Llevar un concepto del Estudio Creativo al tab de Publicar
  function handleConceptToPublish(concept: any) {
    setMessage(concept.caption || concept.headline || concept.conceptName);
    if (concept.image) {
      setGeneratedImage(concept.image);
    }
    setTab("publish");
    toast.success(`Concepto "${concept.conceptName}" transferido a Publicar`);
  }

  // Asistente de Idea Rápida (Autocompletar Formulario)
  async function handleExpandQuickIdea() {
    if (!quickIdea.trim()) {
      toast.error("Escribí tu idea rápida primero");
      return;
    }
    setExpandingIdea(true);
    try {
      const resp = await fetch("/api/expand-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quickIdea,
          llmSettings,
          brandName: currentBrand.name,
          voiceTone: currentBrand.voiceTone,
          brandGuidelines: currentBrand.brandGuidelines,
          projectDescription: currentBrand.projectDescription,
          colors: currentBrand.colors,
          targetAudience: currentBrand.targetAudience,
          valueProposition: currentBrand.valueProposition,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast.error("Error al expandir idea con IA", {
          description: json.detail || json.error || "",
        });
        return;
      }
      const d = json.data;
      if (d) {
        if (d.imageSubject) setImageSubject(d.imageSubject);
        if (d.imageText) setImageText(d.imageText);
        if (d.imageStyle) setImageStyle(d.imageStyle);
        if (d.imageDetails) setImageDetails(d.imageDetails);
        if (d.imageNegative) setImageNegative(d.imageNegative);
        if (d.imageSubtitle) setImageSubtitle(d.imageSubtitle);
        if (d.imageSubtitleStyle) setImageSubtitleStyle(d.imageSubtitleStyle);
        if (d.imageBullets) setImageBullets(d.imageBullets);
        if (d.aspectRatio) {
          setAspectRatioPreset(d.aspectRatio);
          const dims: Record<string, { w: number; h: number }> = {
            "1:1": { w: 1024, h: 1024 },
            "9:16": { w: 768, h: 1360 },
            "4:3": { w: 768, h: 1024 },
          };
          const selectDim = dims[d.aspectRatio as keyof typeof dims];
          if (selectDim) {
            setGenParams((prev) => ({
              ...prev,
              width: selectDim.w,
              height: selectDim.h,
            }));
          }
        }
        if (d.dailyVariation) setDailyVariation(d.dailyVariation);

        // Detección automática de marca basándonos en la idea rápida
        const lowerIdea = quickIdea.toLowerCase();
        const matchedBrand = brands.find((b) => {
          const lowerName = b.name.toLowerCase();
          return (
            lowerIdea.includes(lowerName) ||
            lowerIdea.includes(b.id.toLowerCase()) ||
            (lowerName.split(" ")[0] &&
              lowerName.split(" ")[0].length > 2 &&
              lowerIdea.includes(lowerName.split(" ")[0]))
          );
        });

        if (matchedBrand) {
          setSelectedLogo(matchedBrand.id);
          if (d.imageDetails) setImageDetails(d.imageDetails);
          toast.success("¡Formulario autocompletado!", {
            description: `Se detectó y aplicó automáticamente la marca "${matchedBrand.name}".`,
          });
        } else {
          toast.success("¡Formulario autocompletado!", {
            description: "Revisá los campos y generá la imagen.",
          });
        }
      }
    } catch (err: any) {
      toast.error("Error de conexión al expandir idea", {
        description: err.message,
      });
    } finally {
      setExpandingIdea(false);
    }
  }

  // Aplicar logo vectorizado (SVG) o imagen real cargada de marca
  async function handleApplyBrandLogo() {
    if (selectedLogo === "ninguno") {
      toast.error("Seleccioná un logo de marca primero");
      return;
    }
    if (!generatedImage) {
      toast.error("Generá una imagen primero");
      return;
    }
    setApplyingBrand(true);
    try {
      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      baseImg.src = generatedImage;

      await new Promise((resolve, reject) => {
        baseImg.onload = resolve;
        baseImg.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = baseImg.naturalWidth;
      canvas.height = baseImg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo crear contexto 2D");

      // Dibujar imagen base
      ctx.drawImage(baseImg, 0, 0);

      // Buscar si la marca seleccionada tiene logoDataUrl
      const matchedBrand = brands.find((b) => b.id === selectedLogo);
      const logoImg = new Image();
      let blobURL = "";
      const URL = window.URL || window.webkitURL || window;

      if (matchedBrand && matchedBrand.logoDataUrl) {
        logoImg.src = matchedBrand.logoDataUrl;
      } else {
        const presetId = matchedBrand?.logoPreset || selectedLogo;
        const svgText = BRAND_LOGOS[presetId as keyof typeof BRAND_LOGOS];
        if (!svgText) throw new Error("No se encontró el logo de la marca");
        const svgBlob = new Blob([svgText], {
          type: "image/svg+xml;charset=utf-8",
        });
        blobURL = URL.createObjectURL(svgBlob);
        logoImg.src = blobURL;
      }

      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
      });

      // Tamaño e inserción (aproximadamente 14% del ancho de la imagen)
      const logoSize = Math.max(Math.min(baseImg.naturalWidth * 0.14, 180), 80);
      const padding = Math.max(baseImg.naturalWidth * 0.03, 20);

      let x = padding;
      let y = padding;

      if (logoPosition === "top_right") {
        x = baseImg.naturalWidth - logoSize - padding;
      } else if (logoPosition === "bottom_left") {
        y = baseImg.naturalHeight - logoSize - padding;
      } else if (logoPosition === "bottom_right") {
        x = baseImg.naturalWidth - logoSize - padding;
        y = baseImg.naturalHeight - logoSize - padding;
      }

      ctx.drawImage(logoImg, x, y, logoSize, logoSize);

      if (blobURL) {
        URL.revokeObjectURL(blobURL);
      }

      const newBase64 = canvas.toDataURL("image/png");
      setGeneratedImage(newBase64);
      toast.success(
        `Logo de ${matchedBrand?.name || selectedLogo.toUpperCase()} aplicado con éxito`,
      );
    } catch (err: any) {
      toast.error("Error al aplicar el branding", { description: err.message });
    } finally {
      setApplyingBrand(false);
    }
  }

  // Brand preferences are automatically injected in the backend prompt context.

  // Guardar/Actualizar una marca específica en memoria y localStorage
  async function handleUpdateBrand(updatedBrand: BrandConfig) {
    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: updatedBrand }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBrands(data.brands);
      toast.success(`Identidad de ${updatedBrand.name} guardada`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar la marca.",
      );
    }
  }
  async function handleDeleteBrand(brandId: string) {
    try {
      const response = await fetch(
        `/api/brands?id=${encodeURIComponent(brandId)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBrands(data.brands);
      if (draftBrand?.id === brandId) setDraftBrand(null);
      toast.success("Marca eliminada");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la marca.",
      );
    }
  }

  async function handleGenerateCaption() {
    setGeneratingCaption(true);
    try {
      const resp = await fetch("/api/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageSubject,
          imageDetails,
          imageText,
          brandName: currentBrand.name,
          voiceTone: currentBrand.voiceTone,
          brandGuidelines: currentBrand.brandGuidelines,
          projectDescription: currentBrand.projectDescription,
          targetAudience: currentBrand.targetAudience,
          valueProposition: currentBrand.valueProposition,
          llmSettings,
        }),
      });
      const data = await resp.json();
      if (data.success && data.caption) {
        setMessage(data.caption);
        toast.success("Texto redactado por IA");
      } else {
        toast.error("Error al redactar", {
          description: data.detail || data.error || "Desconocido",
        });
      }
    } catch (e: any) {
      toast.error("Falló la conexión con el motor de IA", {
        description: e.message,
      });
    } finally {
      setGeneratingCaption(false);
    }
  }

  /** Anota en el flyer que salió, para que su tarjeta lo muestre. Si falla, la publicación igual salió. */
  async function logFlyerPublished(source: NonNullable<typeof draftSource>, result: { permalink?: string }) {
    try {
      await fetch("/api/flyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "published", brandId: pageId, pageId, ...source, permalink: result.permalink }),
      });
    } catch {
      /* El registro es informativo: no interrumpe la publicación. */
    }
  }

  async function handlePublish() {
    if (!pageId) {
      toast.error("Elegí una página primero");
      return;
    }
    if (!message.trim()) {
      toast.error("Escribí un mensaje");
      return;
    }
    setLoading(true);
    try {
      let endpoint = "/api/publish";
      let body: any = { pageId, message, platforms: selectedPlatforms };

      if (generatedVideo) {
        endpoint = "/api/publish-with-video";
        body = {
          pageId,
          message,
          videoUrl: generatedVideo,
          platforms: selectedPlatforms,
        };
      } else if (generatedImage) {
        endpoint = "/api/publish-with-image";
        body = {
          pageId,
          message,
          image: generatedImage,
          platforms: selectedPlatforms,
        };
      }

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error("Error al publicar", { description: JSON.stringify(data) });
        setHistory((h) => [
          {
            page: pages.find((p) => p.id === pageId)?.name || "?",
            message: message.slice(0, 50),
            status: "❌ Error",
            time: new Date().toLocaleTimeString(),
          },
          ...h,
        ]);
        return;
      }
      toast.success(
        generatedVideo ? "¡Video / Reel publicado!" : "¡Publicado!",
        {
          description: `Post en ${data.page}: ${data.postId || data.videoId || "Éxito"}`,
        },
      );
      setHistory((h) => [
        {
          page: pages.find((p) => p.id === pageId)?.name || "?",
          message: message.slice(0, 50),
          status: "✅ Publicado",
          time: new Date().toLocaleTimeString(),
        },
        ...h,
      ]);
      if (draftSource) void logFlyerPublished(draftSource, data);
      setMessage("");
      setGeneratedImage(null);
      setGeneratedVideo(null);
    } catch (err) {
      toast.error("Error de conexión", { description: String(err) });
    } finally {
      setLoading(false);
    }
  }

  const handleExtractBrand = async () => {
    if (!extractUrl) {
      toast.error("Ingresa una URL válida");
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch("/api/extract-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: extractUrl, llmSettings }),
      });
      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error(
          `El servidor devolvió un error inesperado (500). Respuesta cruda: ${rawText.slice(0, 100)}...`,
        );
      }

      if (!res.ok)
        throw new Error(
          data.detail || data.error || "Error al extraer la marca",
        );

      if (data.data) {
        const d = data.data;
        const newBrand = { ...draftBrand } as BrandConfig;
        newBrand.colors = newBrand.colors || { primary: [], secondary: [] };
        newBrand.typography = newBrand.typography || {
          heading: "Montserrat",
          body: "Inter",
        };

        if (d.brandName) newBrand.name = d.brandName;
        if (d.projectDescription)
          newBrand.projectDescription = d.projectDescription;
        if (d.targetAudience) newBrand.targetAudience = d.targetAudience;
        if (d.valueProposition) newBrand.valueProposition = d.valueProposition;
        if (d.voiceTone) newBrand.voiceTone = d.voiceTone;
        if (d.brandGuidelines) newBrand.brandGuidelines = d.brandGuidelines;
        if (d.colors?.primary) newBrand.colors.primary = d.colors.primary;
        if (d.colors?.secondary) newBrand.colors.secondary = d.colors.secondary;
        if (d.typography) {
          if (d.typography.heading)
            newBrand.typography.heading = d.typography.heading;
          if (d.typography.body) newBrand.typography.body = d.typography.body;
        }
        if (d.logoDataUrl) {
          newBrand.logoDataUrl = d.logoDataUrl;
          newBrand.logoPreset = "ninguno";
        }
        if (d.secondaryLogoUrl) {
          newBrand.secondaryLogoUrl = d.secondaryLogoUrl;
        }
        if (extractUrl) {
          newBrand.websiteUrl = extractUrl;
        }

        setDraftBrand(newBrand as BrandConfig);

        // Auto-guardar inmediatamente en brands.json para que no se pierda al navegar o refrescar
        await handleUpdateBrand(newBrand as BrandConfig);

        toast.success("Kit de Marca auto-completado y guardado", {
          description: d.logoDataUrl
            ? "Logos, colores y directrices guardados en la memoria permanente del sistema."
            : "Colores y directrices guardados en la memoria permanente del sistema.",
        });
      }
    } catch (e: any) {
      toast.error("Error extrayendo marca", { description: String(e.message) });
    } finally {
      setExtracting(false);
    }
  };

  const currentBrand =
    (draftBrand && draftBrand.id === pageId ? draftBrand : null) ||
    brands.find((b) => b.id === pageId) || {
      id: pageId,
      name: pages.find((p) => p.id === pageId)?.name || "",
      logoPreset: "ninguno" as const,
      colors: { primary: ["#ffffff"], secondary: ["#888888"] },
      typography: { heading: "Inter", body: "Inter" },
      styleAspects: "",
      brandGuidelines: "",
      voiceTone: "",
      projectDescription: "",
    };

  const neurocortexBrand =
    brands.find((b) => b.id === "neurocortex") ||
    DEFAULT_BRANDS.find((b) => b.id === "neurocortex") ||
    currentBrand;

  return {
    scheduleLoaded,
    scheduleLoadError,
    tab,
    setTab,
    activeSection,
    setActiveSection,
    pages,
    setPages,
    pageId,
    setPageId,
    message,
    setMessage,
    loading,
    setLoading,
    showConnectModal,
    setShowConnectModal,
    connectingPage,
    setConnectingPage,
    inspectingToken,
    setInspectingToken,
    newPageName,
    setNewPageName,
    newPageCategory,
    setNewPageCategory,
    newPageEmoji,
    setNewPageEmoji,
    newPageId,
    setNewPageId,
    newPageToken,
    setNewPageToken,
    newPageTestConnection,
    setNewPageTestConnection,
    showTokenPlain,
    setShowTokenPlain,
    fetchPages,
    handleInspectToken,
    handleConnectPage,
    handleDeletePage,
    imageSubject,
    setImageSubject,
    imageText,
    setImageText,
    imageStyle,
    setImageStyle,
    imageDetails,
    setImageDetails,
    imageNegative,
    setImageNegative,
    generatedImage,
    setGeneratedImage,
    setDraftSource,
    composerInitialImage,
    setComposerInitialImage,
    composerInitialCopy,
    setComposerInitialCopy,
    composerInitialDesign,
    setComposerInitialDesign,
    imageLoading,
    setImageLoading,
    selectedGenerator,
    setSelectedGenerator,
    genParams,
    setGenParams,
    extractUrl,
    setExtractUrl,
    extracting,
    selectedPlatforms,
    setSelectedPlatforms,
    imageSource,
    setImageSource,
    openaiApiKey,
    setOpenaiApiKey,
    openaiEnvKeySet,
    setOpenaiEnvKeySet,
    geminiEnvKeySet,
    setGeminiEnvKeySet,
    canvaConnected,
    setCanvaConnected,
    canvaDesigns,
    setCanvaDesigns,
    canvaLoading,
    setCanvaLoading,
    canvaSearchQuery,
    setCanvaSearchQuery,
    importingCanvaId,
    setImportingCanvaId,
    selectedCanvaDesignId,
    setSelectedCanvaDesignId,
    canvaPrompt,
    setCanvaPrompt,
    editingWithAi,
    setEditingWithAi,
    creatingCanva,
    setCreatingCanva,
    generatedVideo,
    setGeneratedVideo,
    videoLoading,
    setVideoLoading,
    videoPrompt,
    setVideoPrompt,
    videoNegativePrompt,
    setVideoNegativePrompt,
    videoAspectRatio,
    setVideoAspectRatio,
    videoDuration,
    setVideoDuration,
    videoLightning,
    setVideoLightning,
    videoElapsed,
    setVideoElapsed,
    templateDesignIdForCreation,
    setTemplateDesignIdForCreation,
    templateDesignTitleForCreation,
    setTemplateDesignTitleForCreation,
    creationPrompt,
    setCreationPrompt,
    creatingFromTemplate,
    setCreatingFromTemplate,
    textLayout,
    setTextLayout,
    textStylePreset,
    setTextStylePreset,
    imageSubtitle,
    setImageSubtitle,
    imageSubtitleStyle,
    setImageSubtitleStyle,
    imageBullets,
    setImageBullets,
    dailyVariation,
    setDailyVariation,
    aspectRatioPreset,
    setAspectRatioPreset,
    quickIdea,
    setQuickIdea,
    expandingIdea,
    setExpandingIdea,
    selectedLogo,
    setSelectedLogo,
    logoPosition,
    setLogoPosition,
    applyingBrand,
    setApplyingBrand,
    generatingCaption,
    setGeneratingCaption,
    brands,
    setBrands,
    draftBrand,
    setDraftBrand,
    llmProvider,
    setLlmProvider,
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
    deepseekEnvKeySet,
    setDeepseekEnvKeySet,
    claudeApiKey,
    setClaudeApiKey,
    claudeModel,
    setClaudeModel,
    claudeEnvKeySet,
    jevApiKey,
    setJevApiKey,
    jevEnvKeySet,
    setJevEnvKeySet,
    showLlmModal,
    setShowLlmModal,
    showImageLightbox,
    setShowImageLightbox,
    llmSettings,
    handleSaveLlmSettings,
    comfyuiActive,
    setComfyuiActive,
    canvaServerActive,
    setCanvaServerActive,
    serviceToggling,
    setServiceToggling,
    history,
    setHistory,
    creativeTopic,
    setCreativeTopic,
    creativePlatform,
    setCreativePlatform,
    creativeAspect,
    setCreativeAspect,
    creativeLanguage,
    setCreativeLanguage,
    creativeUpscale,
    setCreativeUpscale,
    creativeLoading,
    setCreativeLoading,
    creativeConcepts,
    setCreativeConcepts,
    creativeProgress,
    setCreativeProgress,
    publishMode,
    setPublishMode,
    scheduledTime,
    setScheduledTime,
    scheduledPosts,
    setScheduledPosts,
    fetchScheduledPosts,
    handleSchedulePost,
    handleCancelSchedule,
    updateServicesStatus,
    handleToggleService,
    checkCanvaStatus,
    fetchCanvaDesigns,
    handleImportCanvaDesign,
    handleEditCanvaWithAi,
    handleCreateCanvaDesign,
    handleCreateFlyerFromTemplate,
    getInitialParams,
    handleGenerateImage,
    handleGenerateVideo,
    handleGenerateConcepts,
    renderingConceptIdx,
    setRenderingConceptIdx,
    renderingConceptEngine,
    setRenderingConceptEngine,
    handleRenderSingleConcept,
    handleCopyConceptCopy,
    handleConceptToPublish,
    handleExpandQuickIdea,
    handleApplyBrandLogo,
    handleUpdateBrand,
    handleDeleteBrand,
    handleGenerateCaption,
    handlePublish,
    handleExtractBrand,
    currentBrand,
    neurocortexBrand,
  };
}
export type WorkspaceController = ReturnType<typeof useWorkspace>;
