"use client";
/* eslint-disable react-hooks/set-state-in-effect -- External image changes hydrate the canvas document. */
import { readEditorDraft,saveEditorDraft } from "@/lib/editor-storage";

import { Button } from "@/components/ui/button";
import {
  Award,
  Download,
  Layers,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelRight,
  Redo2,
  Send,
  Smartphone,
  Sparkles,
  Square,
  Tv,
  Type,
  Undo2,
  Upload,
  Sliders,
  Zap,
} from "lucide-react";
import { useEffect,useRef,useState } from "react";
import { toast } from "sonner";
import { CanvasSizeModal } from "./CanvasSizeModal";
import { ComfyLayerModal } from "./ComfyLayerModal";
import { ComposerTemplatesModal } from "./ComposerTemplates";
import { ImageEditorModal } from "./ImageEditorModal";
import { LayerCanvas } from "./LayerCanvas";
import { LayerList } from "./LayerList";
import { LayerProperties } from "./LayerProperties";
import { PresetsModal } from "./PresetsModal";
import { preloadImage,renderLayersToCanvas } from "./canvas-renderer";
import { createConceptLayers,type ConceptCopy } from "./concept-layers";
import type { ComposerDesign } from "./flyer-design";
import { trimTransparentMargin } from "./trim-image";
import {
ASPECT_RATIOS,
AspectRatioId,
BackgroundLayer,
BrandLogoLayer,
CanvasDimensions,
CanvasLayer,
FlyerTemplate,
GraphicPreset,
ImageLayer,
LayerType,
TextLayer,
TextPreset,
} from "./types";

/** Se exporta a la mayor escala que se pueda publicar; 2 da texto y logo bien nítidos. */
const EXPORT_SCALES = [2, 1.75, 1.5, 1];
/** Next corta los cuerpos de más de 10 MB: deja lugar para el texto del post. */
const MAX_EXPORT_CHARS = 9_500_000;

function initialAspect(copy?: ConceptCopy | null): AspectRatioId {
  return copy?.aspectRatio && copy.aspectRatio in ASPECT_RATIOS
    ? (copy.aspectRatio as AspectRatioId)
    : "1:1";
}

interface LayerComposerProps {
  initialImage?: string | null;
  /** Textos del Estudio creativo que se cargan como capas editables. */
  initialCopy?: ConceptCopy | null;
  /** Flyer ya armado, separado en capas editables. */
  initialDesign?: ComposerDesign | null;
  brandContext?: any;
  brandLogosMap?: Record<string, string>;
  availableBrands?: { id: string; name: string }[];
  onExportToPublish?: (base64Image: string) => void;
}

export function LayerComposer({
  initialImage,
  initialCopy,
  initialDesign,
  brandContext,
  brandLogosMap = {},
  availableBrands = [],
  onExportToPublish,
}: LayerComposerProps) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>(() => initialDesign?.aspectRatio || initialAspect(initialCopy));
  const [customDimensions, setCustomDimensions] = useState<{ width: number; height: number }>({
    width: 1080,
    height: 1080,
  });
  const [isCanvasSizeModalOpen, setIsCanvasSizeModalOpen] = useState(false);

  const canvasDimensions: CanvasDimensions =
    aspectRatio === "custom"
      ? {
          width: customDimensions.width,
          height: customDimensions.height,
          label: "Personalizado",
          sublabel: `${customDimensions.width}×${customDimensions.height}px`,
          iconName: "Sliders",
        }
      : ((aspectRatio in ASPECT_RATIOS
          ? ASPECT_RATIOS[aspectRatio as keyof typeof ASPECT_RATIOS]
          : null) || {
          width: 1080,
          height: 1080,
          label: "1:1 Cuadrado",
          sublabel: "Instagram / Feed / Facebook",
          iconName: "Square",
        });

  // Estado de Pantalla Completa y Paneles
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(true);
  const [showInspectorPanel, setShowInspectorPanel] = useState(true);

  // Marca activa y colores
  const activeBrandName = brandContext?.name || "Tu Marca";
  const activeLogoId = brandContext?.id || "brand-logo";
  const brandColors = {
    primary: brandContext?.colors?.primary || ["#3b82f6"],
    secondary: brandContext?.colors?.secondary || ["#1d4ed8"],
  };

  // Teclado: Escape para salir de pantalla completa
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        toast.info("Modo pantalla completa desactivado");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Estado inicial de capas
  const createDefaultLayers = (bgImage?: string | null): CanvasLayer[] => {
    if (initialDesign) return initialDesign.layers;
    if (initialCopy) {
      const { width, height } = canvasDimensions;
      return [
        {
          id: "bg-default",
          name: "Capa de Fondo",
          type: "background",
          visible: true,
          locked: true,
          opacity: 1,
          blendMode: "normal",
          x: 0,
          y: 0,
          width,
          height,
          rotation: 0,
          fillType: bgImage ? "image" : "gradient",
          color: "#0a0d14",
          gradientStart: "#0f172a",
          gradientEnd: "#020617",
          gradientAngle: 135,
          imageUrl: bgImage || undefined,
        },
        ...createConceptLayers({
          copy: initialCopy,
          width,
          height,
          accentColor: brandColors.secondary[0] || brandColors.primary[0] || "#38bdf8",
          headingFont: brandContext?.typography?.heading || "Montserrat",
          bodyFont: brandContext?.typography?.body || "Montserrat",
          logoId: activeLogoId,
          logoDataUrl: brandContext?.logoDataUrl || undefined,
          brandName: brandContext?.name,
          website: brandContext?.websiteUrl,
        }),
      ];
    }
    return [
      {
        id: "bg-default",
        name: "Capa de Fondo",
        type: "background",
        visible: true,
        locked: true,
        opacity: 1,
        blendMode: "normal",
        x: 0,
        y: 0,
        width: 1080,
        height: 1080,
        rotation: 0,
        fillType: bgImage ? "image" : "gradient",
        color: "#0a0d14",
        gradientStart: "#0f172a",
        gradientEnd: "#020617",
        gradientAngle: 135,
        imageUrl: bgImage || undefined,
      },
      {
        id: "title-default",
        name: "Titular Principal",
        type: "text",
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        x: 90,
        y: 350,
        width: 900,
        height: 200,
        rotation: 0,
        text: "CREA TU PROPIO\nFLYER PROFESIONAL",
        fontFamily: "Bebas Neue",
        fontSize: 90,
        fontWeight: 400,
        fontStyle: "normal",
        color: "#ffffff",
        textAlign: "center",
        letterSpacing: 2,
        lineHeight: 1.0,
        textTransform: "uppercase",
        gradient: {
          enabled: true,
          startColor: "#ffffff",
          endColor: brandColors.primary[0] || "#38bdf8",
          angle: 90,
        },
        shadowBlur: 20,
        shadowColor: "rgba(0,0,0,0.8)",
      },
      {
        id: "subtitle-default",
        name: "Subtítulo / Bajada",
        type: "text",
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        x: 140,
        y: 580,
        width: 800,
        height: 80,
        rotation: 0,
        text: "Edita cada elemento, genera capas con IA y publica directo a tus redes.",
        fontFamily: "Montserrat",
        fontSize: 26,
        fontWeight: 600,
        fontStyle: "normal",
        color: "#e2e8f0",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.3,
        textTransform: "none",
      },
      {
        id: "logo-default",
        name: "Logo de Marca",
        type: "brand-logo",
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        x: 465,
        y: 890,
        width: 150,
        height: 90,
        rotation: 0,
        brandId: activeLogoId,
        variant: "original",
      },
    ];
  };

  const [layers, setLayers] = useState<CanvasLayer[]>(() => createDefaultLayers(initialImage));
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("title-default");
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;

  // Muchos logos traen margen propio: se ajusta para que no se vean chicos.
  const conceptLogo = initialCopy ? brandContext?.logoDataUrl : undefined;
  useEffect(() => {
    if (!conceptLogo) return;
    let cancelled = false;
    void trimTransparentMargin(conceptLogo).then((trimmed) => {
      if (cancelled || trimmed === conceptLogo) return;
      setLayers((current) =>
        current.map((layer) =>
          layer.type === "brand-logo" && layer.customDataUrl === conceptLogo
            ? { ...layer, customDataUrl: trimmed }
            : layer,
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [conceptLogo]);

  // Historial Undo / Redo
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    readEditorDraft(activeLogoId).then(draft => {
      if (!cancelled && draft && !initialImage && !initialCopy && !initialDesign) {
        setLayers(draft.layers);
        setAspectRatio(draft.aspectRatio);
        if (draft.customDimensions) setCustomDimensions(draft.customDimensions);
      }
    }).catch(() => { if (!cancelled) setDraftSaveError(true); }).finally(() => { if (!cancelled) setDraftLoaded(true); });
    return () => { cancelled = true; };
  }, [activeLogoId, initialImage, initialCopy, initialDesign]);
  useEffect(() => {
    if (!draftLoaded) return;
    const timer = setTimeout(() => {
      saveEditorDraft(activeLogoId, {
        layers,
        aspectRatio,
        customDimensions,
        updatedAt: new Date().toISOString(),
      })
        .then(() => setDraftSaveError(false)).catch(() => setDraftSaveError(true));
    }, 500);
    return () => {
      clearTimeout(timer);
      void saveEditorDraft(activeLogoId, {
        layers,
        aspectRatio,
        customDimensions,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    };
  }, [layers, aspectRatio, customDimensions, activeLogoId, draftLoaded]);

  const [history, setHistory] = useState<CanvasLayer[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Modales
  const [isComfyModalOpen, setIsComfyModalOpen] = useState(false);
  const [comfyTargetLayerId, setComfyTargetLayerId] = useState<string | null>(null);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  // Modal de Presets de Letras & Gráficos
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [presetsInitialTab, setPresetsInitialTab] = useState<"text" | "graphics">("text");

  // Input de subida de archivos local
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetLayerId, setUploadTargetLayerId] = useState<string | null>(null);
  const [uploadAsBackground, setUploadAsBackground] = useState<boolean>(false);

  // Editor de imagen raster / retoque
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingImageSrc, setEditingImageSrc] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  // Sincronizar reactivamente si cambia initialImage desde el exterior
  const lastLoadedImageRef = useRef<string | null>(initialImage || null);
  useEffect(() => {
    if (initialImage && initialImage !== lastLoadedImageRef.current) {
      lastLoadedImageRef.current = initialImage;
      setLayers((prev) => {
        const bgIdx = prev.findIndex((l) => l.type === "background");
        if (bgIdx >= 0) {
          const currentBg = prev[bgIdx] as BackgroundLayer;
          const updatedBg: BackgroundLayer = {
            ...currentBg,
            fillType: "image",
            imageUrl: initialImage,
          };
          const updated = [...prev];
          updated[bgIdx] = updatedBg;
          return updated;
        }
        const newBg: BackgroundLayer = {
          id: `bg-${Date.now()}`,
          name: "Capa de Fondo",
          type: "background",
          visible: true,
          locked: true,
          opacity: 1,
          blendMode: "normal",
          x: 0,
          y: 0,
          width: canvasDimensions.width,
          height: canvasDimensions.height,
          rotation: 0,
          fillType: "image",
          color: "#0a0d14",
          imageUrl: initialImage,
        };
        return [newBg, ...prev];
      });
      toast.info("Nueva imagen cargada en el lienzo del Compositor");
    }
  }, [initialImage, canvasDimensions]);

  // Sincronizar logo de marca si cambia el contexto de marca activo
  const lastBrandIdRef = useRef<string>(activeLogoId);
  useEffect(() => {
    if (brandContext?.id && brandContext.id !== lastBrandIdRef.current) {
      lastBrandIdRef.current = brandContext.id;
      setLayers((prev) =>
        prev.map((l) => {
          if (l.type === "brand-logo") {
            const logo = l as BrandLogoLayer;
            const updatedLogo: BrandLogoLayer = {
              ...logo,
              brandId: brandContext.id,
              customDataUrl: brandContext.logoDataUrl || undefined,
            };
            return updatedLogo;
          }
          return l;
        })
      );
    }
  }, [brandContext, activeLogoId]);

  // Trigger para abrir el explorador de archivos
  function triggerFileUpload(asBackground = false, targetLayerId?: string) {
    setUploadAsBackground(asBackground);
    setUploadTargetLayerId(targetLayerId || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  // Manejador central de subida de imágenes (desde picker o Drag & Drop)
  async function handleUploadImageFiles(
    files: FileList | File[],
    targetLayerId?: string,
    asBackground?: boolean
  ) {
    const isBg = asBackground !== undefined ? asBackground : uploadAsBackground;
    const targetId = targetLayerId || uploadTargetLayerId;
    const fileArray = Array.from(files);

    if (fileArray.length === 0) return;

    for (const file of fileArray) {
      if (!file.type.startsWith("image/")) {
        toast.error(`El archivo "${file.name}" no es una imagen válida`);
        continue;
      }

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const img = await preloadImage(dataUrl);
        const naturalW = img.naturalWidth || 800;
        const naturalH = img.naturalHeight || 800;
        const dimensions = canvasDimensions;

        if (isBg) {
          // Reemplazar fondo con la imagen subida
          setLayers((prev) => {
            const next: CanvasLayer[] = prev.map((l) =>
              l.type === "background"
                ? {
                    ...l,
                    fillType: "image" as const,
                    imageUrl: dataUrl,
                    name: `Fondo: ${file.name}`,
                  }
                : l
            );
            pushHistory(next);
            return next;
          });
          toast.success(`Fondo actualizado con "${file.name}"`, {
            action: {
              label: `📐 Ajustar Lienzo (${naturalW}×${naturalH})`,
              onClick: () => handleFitCanvasToImage(dataUrl, naturalW, naturalH),
            },
          });
        } else if (targetId) {
          // Reemplazar en la capa específica
          setLayers((prev) => {
            const next: CanvasLayer[] = prev.map((l) => {
              if (l.id !== targetId) return l;
              if (l.type === "image" || l.type === "background") {
                return { ...l, imageUrl: dataUrl, name: file.name };
              }
              return l;
            });
            pushHistory(next);
            return next;
          });
          toast.success(`Capa actualizada con "${file.name}"`);
        } else {
          // Crear nueva capa de imagen calculando proporción óptima
          const maxDim = Math.min(dimensions.width * 0.6, 600);
          let layerW = maxDim;
          let layerH = (maxDim / naturalW) * naturalH;

          if (layerH > dimensions.height * 0.6) {
            layerH = dimensions.height * 0.6;
            layerW = (layerH / naturalH) * naturalW;
          }

          layerW = Math.round(layerW);
          layerH = Math.round(layerH);

          const newLayer: ImageLayer = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: file.name.replace(/\.[^/.]+$/, ""),
            type: "image",
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: "normal",
            x: Math.round(dimensions.width / 2 - layerW / 2),
            y: Math.round(dimensions.height / 2 - layerH / 2),
            width: layerW,
            height: layerH,
            rotation: 0,
            imageUrl: dataUrl,
            objectFit: "contain",
            borderRadius: 0,
          };

          setLayers((prev) => {
            const next = [...prev, newLayer];
            pushHistory(next);
            return next;
          });
          setSelectedLayerId(newLayer.id);
          toast.success(`Capa "${file.name}" subida con éxito`, {
            action: {
              label: `📐 Ajustar Lienzo (${naturalW}×${naturalH})`,
              onClick: () => handleFitCanvasToImage(dataUrl, naturalW, naturalH),
            },
          });
        }
      } catch (err: any) {
        console.error("Error al procesar archivo de imagen:", err);
        toast.error(`Error al procesar "${file.name}"`);
      }
    }
  }

  // Aplicar Preset de Letras / Tipografía
  function handleSelectTextPreset(preset: TextPreset) {
    const dimensions = canvasDimensions;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const primaryColor = brandColors.primary[0] || "#3b82f6";
    const secondaryColor = brandColors.secondary[0] || "#f59e0b";

    const presetData = preset.createLayer(primaryColor, secondaryColor, centerX, centerY);

    const newLayer: TextLayer = {
      // eslint-disable-next-line react-hooks/purity -- A user-selected preset creates an ID in its click handler.
      id: `text-${Date.now()}`,
      name: presetData.name || preset.name,
      type: "text",
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      x: presetData.x ?? centerX - 300,
      y: presetData.y ?? centerY - 50,
      width: presetData.width ?? 600,
      height: presetData.height ?? 100,
      rotation: 0,
      text: presetData.text || "Nuevo Texto",
      fontFamily: presetData.fontFamily || "Outfit",
      fontSize: presetData.fontSize || 48,
      fontWeight: presetData.fontWeight || 700,
      fontStyle: presetData.fontStyle || "normal",
      color: presetData.color || "#ffffff",
      textAlign: presetData.textAlign || "center",
      letterSpacing: presetData.letterSpacing || 0,
      lineHeight: presetData.lineHeight || 1.15,
      textTransform: presetData.textTransform || "none",
      gradient: presetData.gradient,
      strokeColor: presetData.strokeColor,
      strokeWidth: presetData.strokeWidth,
      shadowBlur: presetData.shadowBlur,
      shadowColor: presetData.shadowColor,
      shadowOffsetY: presetData.shadowOffsetY,
      glow: presetData.glow,
      glowColor: presetData.glowColor,
      boxBackground: presetData.boxBackground,
    };

    setLayers((prev) => {
      const next = [...prev, newLayer];
      pushHistory(next);
      return next;
    });
    setSelectedLayerId(newLayer.id);
    toast.success(`Estilo "${preset.name}" agregado`);
  }

  // Aplicar Preset de Badges / Formas
  function handleSelectGraphicPreset(preset: GraphicPreset) {
    const dimensions = canvasDimensions;
    const primaryColor = brandColors.primary[0] || "#3b82f6";
    const secondaryColor = brandColors.secondary[0] || "#f59e0b";

    const newCreatedLayers = preset.createLayers(
      primaryColor,
      secondaryColor,
      dimensions.width,
      dimensions.height
    );

    setLayers((prev) => {
      const next = [...prev, ...newCreatedLayers];
      pushHistory(next);
      return next;
    });

    if (newCreatedLayers.length > 0) {
      setSelectedLayerId(newCreatedLayers[0].id);
    }
    toast.success(`Elemento "${preset.name}" agregado`);
  }

  // Actualizar imagen si cambia initialImage desde fuera
  useEffect(() => {
    if (initialImage) {
      setLayers((prev) =>
        prev.map((l) =>
          l.type === "background"
            ? { ...l, fillType: "image", imageUrl: initialImage }
            : l
        )
      );
    }
  }, [initialImage]);

  // Guardar estado en historial
  function pushHistory(newLayers: CanvasLayer[]) {
    const currentHist = history.slice(0, historyIndex + 1);
    setHistory([...currentHist, newLayers]);
    setHistoryIndex(currentHist.length);
  }

  function handleUndo() {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setLayers(history[historyIndex - 1]);
    }
  }

  function handleRedo() {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setLayers(history[historyIndex + 1]);
    }
  }

  // Actualizar propiedades de una capa
  function handleUpdateLayer(layerId: string, updates: Partial<CanvasLayer>) {
    setLayers((prev) => {
      const next = prev.map((l) => (l.id === layerId ? ({ ...l, ...updates } as CanvasLayer) : l));
      return next;
    });
  }

  // Abrir editor raster para una capa de imagen o fondo
  function handleOpenImageEditor(layerId: string, imageSrc: string) {
    if (!imageSrc) {
      toast.error("La capa no contiene una imagen para editar");
      return;
    }
    setEditingLayerId(layerId);
    setEditingImageSrc(imageSrc);
    setIsImageEditorOpen(true);
  }

  // Guardar cambios desde el editor raster
  function handleSaveImageFromEditor(newImageSrc: string) {
    if (!editingLayerId) return;

    setLayers((prev) => {
      const next: CanvasLayer[] = prev.map((l) => {
        if (l.id !== editingLayerId) return l;
        if (l.type === "image" || l.type === "background") {
          return { ...l, imageUrl: newImageSrc };
        }
        return l;
      });
      pushHistory(next);
      return next;
    });

    setIsImageEditorOpen(false);
    setEditingLayerId(null);
    setEditingImageSrc(null);
    toast.success("Imagen retocada guardada en la capa");
  }

  // Reordenar capas (Z-Index)
  function handleReorderLayers(fromIndex: number, toIndex: number) {
    setLayers((prev) => {
      if (fromIndex <= 0 || fromIndex >= prev.length) return prev;
      const safeToIndex = Math.max(1, Math.min(prev.length - 1, toIndex));
      if (safeToIndex === fromIndex) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(safeToIndex, 0, moved);
      pushHistory(copy);
      return copy;
    });
  }

  // Traer al frente (máxima prioridad)
  function handleBringToFront(layerId: string) {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx === -1 || idx === layers.length - 1) return;
    const copy = [...layers];
    const [item] = copy.splice(idx, 1);
    copy.push(item);
    setLayers(copy);
    pushHistory(copy);
    toast.success(`"${item.name}" traída al frente`);
  }

  // Traer adelante (subir 1 nivel)
  function handleBringForward(layerId: string) {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx === -1 || idx >= layers.length - 1) return;
    const copy = [...layers];
    const [item] = copy.splice(idx, 1);
    copy.splice(idx + 1, 0, item);
    setLayers(copy);
    pushHistory(copy);
    toast.success(`"${item.name}" movida adelante`);
  }

  // Enviar atrás (bajar 1 nivel, sin pasar el fondo)
  function handleSendBackward(layerId: string) {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx <= 1) return; // Índice 0 es el fondo
    const copy = [...layers];
    const [item] = copy.splice(idx, 1);
    copy.splice(idx - 1, 0, item);
    setLayers(copy);
    pushHistory(copy);
    toast.success(`"${item.name}" movida atrás`);
  }

  // Enviar al fondo (justo arriba de la capa de fondo)
  function handleSendToBack(layerId: string) {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx <= 1) return;
    const copy = [...layers];
    const [item] = copy.splice(idx, 1);
    copy.splice(1, 0, item);
    setLayers(copy);
    pushHistory(copy);
    toast.success(`"${item.name}" enviada al fondo`);
  }

  // Duplicar capa
  function handleDuplicateLayer(layerId: string) {
    const target = layers.find((l) => l.id === layerId);
    if (!target || target.type === "background") return;

    const newLayer: CanvasLayer = {
      ...target,
      id: `layer-${Date.now()}`,
      name: `${target.name} (Copia)`,
      x: target.x + 30,
      y: target.y + 30,
    };

    setLayers((prev) => {
      const next = [...prev, newLayer];
      pushHistory(next);
      return next;
    });
    setSelectedLayerId(newLayer.id);
    toast.success("Capa duplicada");
  }

  // Eliminar capa
  function handleDeleteLayer(layerId: string) {
    const target = layers.find((l) => l.id === layerId);
    if (!target || target.type === "background") return;

    setLayers((prev) => {
      const next = prev.filter((l) => l.id !== layerId);
      pushHistory(next);
      return next;
    });
    setSelectedLayerId(null);
    toast.info("Capa eliminada");
  }

  // Agregar nueva capa
  function handleAddLayer(type: LayerType) {
    const dimensions = canvasDimensions;
    let newLayer: CanvasLayer;

    const id = `layer-${Date.now()}`;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    switch (type) {
      case "text":
        newLayer = {
          id,
          name: "Nuevo Texto",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: centerX - 300,
          y: centerY - 50,
          width: 600,
          height: 100,
          rotation: 0,
          text: "Nuevo Texto",
          fontFamily: "Outfit",
          fontSize: 48,
          fontWeight: 700,
          fontStyle: "normal",
          color: "#ffffff",
          textAlign: "center",
          letterSpacing: 0,
          lineHeight: 1.2,
          textTransform: "none",
        };
        break;
      case "shape":
        newLayer = {
          id,
          name: "Forma / Badge",
          type: "shape",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: centerX - 150,
          y: centerY - 150,
          width: 300,
          height: 300,
          rotation: 0,
          shapeType: "rectangle",
          fillType: "solid",
          fillColor: brandColors.primary[0] || "#3b82f6",
          borderRadius: 16,
        };
        break;
      case "image":
        newLayer = {
          id,
          name: "Capa de Imagen",
          type: "image",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: centerX - 250,
          y: centerY - 250,
          width: 500,
          height: 500,
          rotation: 0,
          imageUrl: "",
          objectFit: "cover",
          borderRadius: 12,
        };
        break;
      case "brand-logo":
        newLayer = {
          id,
          name: `Logo (${activeBrandName})`,
          type: "brand-logo",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: Math.round(centerX - 100),
          y: Math.max(40, Math.round(dimensions.height - 180)),
          width: 200,
          height: 100,
          rotation: 0,
          brandId: activeLogoId,
          variant: "original",
          customDataUrl: brandContext?.logoDataUrl || undefined,
        };
        break;
      default:
        return;
    }

    setLayers((prev) => {
      const next = [...prev, newLayer];
      pushHistory(next);
      return next;
    });
    setSelectedLayerId(newLayer.id);
    toast.success(`Capa de ${type} agregada`);
  }

  // Aplicar imagen generada con ComfyUI
  function handleApplyImageFromComfy(
    targetId: string | null,
    imageUrl: string,
    promptUsed: string,
    generatorUsed: string
  ) {
    if (!targetId) {
      // Crear nueva capa de imagen
      const dimensions = canvasDimensions;
      const newLayer: ImageLayer = {
        id: `ai-img-${Date.now()}`,
        name: `IA: ${generatorUsed}`,
        type: "image",
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        x: dimensions.width / 2 - 300,
        y: dimensions.height / 2 - 300,
        width: 600,
        height: 600,
        rotation: 0,
        imageUrl,
        objectFit: "cover",
        promptUsed,
        aiGenerator: generatorUsed,
      };
      setLayers((prev) => {
        const next = [...prev, newLayer];
        pushHistory(next);
        return next;
      });
      setSelectedLayerId(newLayer.id);
    } else {
      // Reemplazar en la capa especificada
      setLayers((prev) => {
        const next: CanvasLayer[] = prev.map((l) => {
          if (l.id !== targetId) return l;
          if (l.type === "background") {
            return {
              ...l,
              fillType: "image" as const,
              imageUrl,
              promptUsed,
              aiGenerator: generatorUsed,
            };
          }
          if (l.type === "image") {
            return {
              ...l,
              imageUrl,
              promptUsed,
              aiGenerator: generatorUsed,
            };
          }
          return l;
        });
        pushHistory(next);
        return next;
      });
    }
  }

  // Aplicar plantilla predefinida
  function handleSelectTemplate(tmpl: FlyerTemplate) {
    const newLayers = tmpl.createLayers(brandColors, activeBrandName, activeLogoId);
    setAspectRatio(tmpl.aspectRatio);
    setLayers(newLayers);
    setSelectedLayerId(newLayers[1]?.id || newLayers[0]?.id);
    pushHistory(newLayers);
    toast.success(`Plantilla "${tmpl.name}" aplicada`);
  }

  // Exportar a imagen final en alta resolución
  async function generateExportBase64(): Promise<string> {
    const offscreenCanvas = document.createElement("canvas");
    const dimensions = canvasDimensions;
    let result = "";
    for (const scale of EXPORT_SCALES) {
      await renderLayersToCanvas(offscreenCanvas, layers, dimensions, brandLogosMap, scale);
      result = offscreenCanvas.toDataURL("image/png");
      if (result.length <= MAX_EXPORT_CHARS) break;
    }
    return result;
  }

  // Descargar PNG
  async function handleDownloadPng() {
    setExporting(true);
    try {
      const base64 = await generateExportBase64();
      const a = document.createElement("a");
      a.href = base64;
      a.download = `flyer-${activeBrandName.toLowerCase()}-${Date.now()}.png`;
      a.click();
      toast.success("Flyer descargado en alta resolución");
    } catch (err: any) {
      toast.error("Error al exportar imagen", { description: err.message });
    } finally {
      setExporting(false);
    }
  }

  // Enviar directo a Publicar
  async function handleSendToPublish() {
    setExporting(true);
    try {
      const base64 = await generateExportBase64();
      if (onExportToPublish) {
        onExportToPublish(base64);
        toast.success("Flyer enviado a la pestaña de Publicación");
      }
    } catch (err: any) {
      toast.error("Error al preparar la imagen para publicar", { description: err.message });
    } finally {
      setExporting(false);
    }
  }

  // Obtener dimensiones de la imagen activa (capa de imagen o fondo con foto)
  const activeImageDimensions = (() => {
    if (selectedLayer && selectedLayer.type === "image" && selectedLayer.imageUrl) {
      return {
        width: selectedLayer.width,
        height: selectedLayer.height,
        name: selectedLayer.name,
      };
    }
    const bg = layers.find((l) => l.type === "background" && l.fillType === "image" && l.imageUrl) as
      | BackgroundLayer
      | undefined;
    if (bg && bg.imageUrl) {
      return {
        width: bg.width,
        height: bg.height,
        name: bg.name || "Foto de Fondo",
      };
    }
    const firstImg = layers.find((l) => l.type === "image" && l.imageUrl) as ImageLayer | undefined;
    if (firstImg && firstImg.imageUrl) {
      return {
        width: firstImg.width,
        height: firstImg.height,
        name: firstImg.name,
      };
    }
    return null;
  })();

  // Ajustar el lienzo al tamaño y proporción exactos de una imagen (cero bordes o espacios vacíos)
  async function handleFitCanvasToImage(imageUrl?: string, explicitW?: number, explicitH?: number) {
    try {
      let targetW = explicitW;
      let targetH = explicitH;
      let src = imageUrl;
      let targetLayerId: string | null = null;

      if (!targetW || !targetH) {
        if (!src) {
          if (selectedLayer && selectedLayer.type === "image" && selectedLayer.imageUrl) {
            src = selectedLayer.imageUrl;
            targetLayerId = selectedLayer.id;
          } else {
            const bg = layers.find((l) => l.type === "background" && l.fillType === "image" && l.imageUrl) as
              | BackgroundLayer
              | undefined;
            if (bg && bg.imageUrl) {
              src = bg.imageUrl;
              targetLayerId = bg.id;
            } else {
              const firstImg = layers.find((l) => l.type === "image" && l.imageUrl) as ImageLayer | undefined;
              if (firstImg && firstImg.imageUrl) {
                src = firstImg.imageUrl;
                targetLayerId = firstImg.id;
              }
            }
          }
        }

        if (!src) {
          toast.info("No hay ninguna imagen activa en el lienzo para ajustar.");
          return;
        }

        const img = await preloadImage(src);
        targetW = img.naturalWidth || 1080;
        targetH = img.naturalHeight || 1080;
      }

      // Normalizar proporcionalmente si excede límites de alta resolución (3840px)
      if (targetW > 3840 || targetH > 3840) {
        const maxDim = 3840;
        if (targetW >= targetH) {
          targetH = Math.round((maxDim / targetW) * targetH);
          targetW = maxDim;
        } else {
          targetW = Math.round((maxDim / targetH) * targetW);
          targetH = maxDim;
        }
      }

      targetW = Math.round(targetW);
      targetH = Math.round(targetH);

      setCustomDimensions({ width: targetW, height: targetH });
      setAspectRatio("custom");

      // Actualizar capas: el fondo se adapta a las nuevas medidas
      setLayers((prev) => {
        const next = prev.map((l) => {
          if (l.type === "background") {
            return {
              ...l,
              width: targetW!,
              height: targetH!,
            };
          }
          // Si es la capa de imagen objetivo o la única imagen, expandirla para cubrir el lienzo sin bordes
          if (l.id === targetLayerId || (l.type === "image" && l.imageUrl === src)) {
            return {
              ...l,
              x: 0,
              y: 0,
              width: targetW!,
              height: targetH!,
              objectFit: "cover" as const,
            };
          }
          return l;
        });
        pushHistory(next);
        return next;
      });

      toast.success(`Lienzo ajustado a la imagen: ${targetW}×${targetH}px (sin espacios vacíos)`);
    } catch (err: any) {
      console.error("Error al ajustar lienzo a la imagen:", err);
      toast.error("Error al calcular las dimensiones de la imagen");
    }
  }

  // Aplicar dimensiones personalizadas desde el modal
  function handleApplyCustomDimensions({
    width,
    height,
    fitBackground,
    fitImage,
  }: {
    width: number;
    height: number;
    fitBackground: boolean;
    fitImage: boolean;
  }) {
    const targetW = Math.round(width);
    const targetH = Math.round(height);

    setCustomDimensions({ width: targetW, height: targetH });
    setAspectRatio("custom");

    setLayers((prev) => {
      const next = prev.map((l) => {
        if (l.type === "background" && fitBackground) {
          return { ...l, width: targetW, height: targetH };
        }
        if (l.type === "image" && fitImage && (selectedLayerId === l.id || !selectedLayerId)) {
          return {
            ...l,
            x: 0,
            y: 0,
            width: targetW,
            height: targetH,
            objectFit: "cover" as const,
          };
        }
        return l;
      });
      pushHistory(next);
      return next;
    });

    toast.success(`Lienzo configurado a ${targetW}×${targetH}px`);
  }

  // Convertir foto de fondo en una capa de imagen libre y movible
  function handleConvertBackgroundToImage(bgLayerId: string) {
    const bgLayer = layers.find((l) => l.id === bgLayerId);
    if (!bgLayer || bgLayer.type !== "background" || !bgLayer.imageUrl) {
      toast.error("La capa de fondo no contiene una imagen para convertir");
      return;
    }

    const dimensions = canvasDimensions;
    const newImageLayer: ImageLayer = {
      id: `img-${Date.now()}`,
      name: bgLayer.name?.replace("Fondo: ", "") || "Foto Libre",
      type: "image",
      visible: true,
      locked: false,
      opacity: bgLayer.opacity ?? 1,
      blendMode: bgLayer.blendMode || "normal",
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height,
      rotation: 0,
      imageUrl: bgLayer.imageUrl,
      objectFit: "cover",
    };

    // Actualizamos el fondo a un degradado oscuro neutral y agregamos la imagen como capa libre arriba del fondo
    setLayers((prev) => {
      const next: CanvasLayer[] = prev.map((l) =>
        l.id === bgLayerId && l.type === "background"
          ? ({
              ...l,
              fillType: "gradient",
              imageUrl: undefined,
              color: "#0a0d14",
              gradientStart: "#0f172a",
              gradientEnd: "#020617",
              name: "Capa de Fondo (Base)",
            } as CanvasLayer)
          : l
      );
      next.splice(1, 0, newImageLayer);
      pushHistory(next);
      return next;
    });

    setSelectedLayerId(newImageLayer.id);
    toast.success("Foto convertida a capa libre. ¡Ahora puedes moverla y cambiar su tamaño!");
  }

  // Cálculo de clases de columnas según los paneles visibles
  const centerColClass =
    showLayersPanel && showInspectorPanel
      ? "md:col-span-6"
      : showLayersPanel || showInspectorPanel
      ? "md:col-span-9"
      : "md:col-span-12";

  return (
    <div
      className={`flex flex-col bg-zinc-950 transition-all duration-200 overflow-hidden shadow-2xl ${
        isFullscreen
          ? "fixed inset-0 z-50 w-screen h-screen rounded-none border-0"
          : "h-[calc(100vh-140px)] min-h-[680px] rounded-2xl border border-zinc-800/80"
      }`}
    >
      {/* BARRA SUPERIOR DE HERRAMIENTAS (TOOLBAR) */}
      <div className="px-3 md:px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-2 select-none flex-wrap">
        {/* Izquierda: Título, Selector de Formato & Alternador de Paneles */}
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 shadow-md">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <span role="status" className="text-[10px] text-slate-400">{draftSaveError ? "No se pudo guardar el borrador" : draftLoaded ? "Borrador guardado en este navegador" : "Cargando borrador…"}</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-1.5">
                Compositor de Capas & Flyer Pro
              </h2>
              <span className="text-[10px] text-zinc-400 font-medium">
                Marca: <strong className="text-amber-400">{activeBrandName}</strong>
              </span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-zinc-800 mx-1 hidden sm:block" />

          {/* Botones para ocultar/mostrar paneles laterales para mayor espacio */}
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 gap-0.5 text-xs">
            <button
              onClick={() => setShowLayersPanel((v) => !v)}
              className={`p-1.5 rounded text-[11px] transition-all flex items-center gap-1 ${
                showLayersPanel
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title={showLayersPanel ? "Ocultar panel de Capas" : "Mostrar panel de Capas"}
            >
              <PanelLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Capas</span>
            </button>
            <button
              onClick={() => setShowInspectorPanel((v) => !v)}
              className={`p-1.5 rounded text-[11px] transition-all flex items-center gap-1 ${
                showInspectorPanel
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title={showInspectorPanel ? "Ocultar panel Inspector" : "Mostrar panel Inspector"}
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Inspector</span>
            </button>
          </div>

          <div className="h-5 w-[1px] bg-zinc-800 mx-1 hidden sm:block" />

          {/* Selector de Aspect Ratio con botones rápidos */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 gap-1 text-xs">
            <button
              onClick={() => setAspectRatio("1:1")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                aspectRatio === "1:1"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Square className="w-3 h-3" />
              1:1
            </button>

            <button
              onClick={() => setAspectRatio("9:16")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                aspectRatio === "9:16"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Smartphone className="w-3 h-3" />
              9:16
            </button>

            <button
              onClick={() => setAspectRatio("4:5")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                aspectRatio === "4:5"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Maximize2 className="w-3 h-3" />
              4:5
            </button>

            <button
              onClick={() => setAspectRatio("16:9")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                aspectRatio === "16:9"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Tv className="w-3 h-3" />
              16:9
            </button>

            {/* Botón Personalizado con medidas */}
            <button
              onClick={() => setIsCanvasSizeModalOpen(true)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                aspectRatio === "custom"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Personalizar dimensiones del lienzo (Ancho × Alto en px)"
            >
              <Sliders className="w-3 h-3 text-amber-400" />
              <span>{aspectRatio === "custom" ? `${customDimensions.width}×${customDimensions.height}` : "Medidas"}</span>
            </button>
          </div>

          {/* Botón rápido: Ajustar Lienzo a Imagen */}
          {activeImageDimensions && (
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => handleFitCanvasToImage()}
              className="h-7 px-2.5 bg-amber-950/40 border-amber-500/40 hover:bg-amber-900/50 text-amber-300 text-[11px] font-semibold gap-1.5 shadow-sm"
              title={`Ajustar el lienzo exactamente a la imagen (${activeImageDimensions.width}×${activeImageDimensions.height}px) sin dejar bordes`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Ajustar a Imagen</span>
              <span className="xl:hidden">Ajustar</span>
            </Button>
          )}
        </div>

        {/* Centro: Subir Foto, Letras, Formas, IA, Plantillas & Deshacer */}
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          {/* Botón Subir Imagen / Foto desde Ordenador */}
          <Button
            size="sm"
            onClick={() => triggerFileUpload(false)}
            className="h-8 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold gap-1.5 shadow-md"
            title="Subir archivo de imagen desde tu ordenador"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Subir Foto</span>
          </Button>

          {/* Botón de Logo de Marca */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddLayer("brand-logo")}
            className="h-8 bg-zinc-950/80 border-purple-500/40 hover:bg-purple-500/10 text-purple-300 text-xs gap-1.5 shadow-sm font-medium"
            title="Agregar capa con Logo de la marca"
          >
            <Award className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">+ Logo</span>
          </Button>

          {/* Botón de Letras & Estilos */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPresetsInitialTab("text");
              setIsPresetsModalOpen(true);
            }}
            className="h-8 bg-zinc-950/80 border-amber-500/40 hover:bg-amber-500/10 text-amber-300 text-xs gap-1.5 shadow-sm"
            title="Explorar e insertar estilos de letras y titulares"
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+ Letras</span>
          </Button>

          {/* Botón de Formas & Badges */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPresetsInitialTab("graphics");
              setIsPresetsModalOpen(true);
            }}
            className="h-8 bg-zinc-950/80 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-300 text-xs gap-1.5 shadow-sm"
            title="Explorar e insertar badges, formas y overlays"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">+ Formas</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTemplatesModalOpen(true)}
            className="h-8 bg-zinc-950/80 border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs gap-1.5 shadow-sm"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Plantillas</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setComfyTargetLayerId(null);
              setIsComfyModalOpen(true);
            }}
            className="h-8 bg-gradient-to-r from-cyan-950 to-blue-950 border-cyan-600/50 hover:border-cyan-400 text-cyan-300 text-xs gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline">Generar IA</span>
          </Button>

          <div className="flex items-center bg-zinc-950 rounded-lg border border-zinc-800 p-0.5">
            <button
              disabled={historyIndex <= 0}
              onClick={handleUndo}
              className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 rounded"
              title="Deshacer (Undo)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 rounded"
              title="Rehacer (Redo)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Derecha: Pantalla Completa & Exportar / Publicar */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Botón de Maximizar / Pantalla Completa */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsFullscreen((f) => !f);
              if (!isFullscreen) toast.success("Modo pantalla completa activado (presiona Esc para salir)");
            }}
            className={`h-8 px-2.5 text-xs gap-1.5 transition-all ${
              isFullscreen
                ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                : "bg-zinc-950 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
            }`}
            title={isFullscreen ? "Restaurar tamaño (Esc)" : "Maximizar a Pantalla Completa"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Restaurar</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Maximizar</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPng}
            disabled={exporting}
            className="h-8 bg-zinc-950 border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Descargar PNG</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSendToPublish}
            disabled={exporting}
            className="h-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold gap-1.5 shadow-lg"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Publicar</span>
          </Button>
        </div>
      </div>

      {/* Input Oculto para Subir Imágenes desde el Ordenador */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadImageFiles(e.target.files);
          }
        }}
      />

      {/* ÁREA DE TRABAJO PRINCIPAL (GRID DINÁMICO) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 p-3 overflow-hidden bg-zinc-950/60">
        {/* Columna Izquierda: Árbol de Capas (3 cols) */}
        {showLayersPanel && (
          <div className="md:col-span-3 h-full overflow-hidden">
            <LayerList
              layers={layers}
              selectedLayerId={selectedLayerId}
              onSelectLayer={(id) => setSelectedLayerId(id)}
              onUpdateLayer={handleUpdateLayer}
              onReorderLayers={handleReorderLayers}
              onBringToFront={handleBringToFront}
              onBringForward={handleBringForward}
              onSendBackward={handleSendBackward}
              onSendToBack={handleSendToBack}
              onDuplicateLayer={handleDuplicateLayer}
              onDeleteLayer={handleDeleteLayer}
              onAddLayer={handleAddLayer}
              onOpenComfyModal={(targetId) => {
                setComfyTargetLayerId(targetId || null);
                setIsComfyModalOpen(true);
              }}
              onUploadFileClick={() => triggerFileUpload(false)}
              onOpenPresetsModal={(tab) => {
                setPresetsInitialTab(tab || "text");
                setIsPresetsModalOpen(true);
              }}
            />
          </div>
        )}

        {/* Columna Central: Viewport del Canvas Interactivo (ColSpan dinámico 6, 9 o 12 cols) */}
        <div className={`${centerColClass} h-full flex flex-col overflow-hidden`}>
          <LayerCanvas
            layers={layers}
            selectedLayerId={selectedLayerId}
            aspectRatio={aspectRatio}
            canvasDimensions={canvasDimensions}
            brandLogosMap={brandLogosMap}
            isFullscreen={isFullscreen}
            onSelectLayer={(id) => setSelectedLayerId(id)}
            onUpdateLayer={handleUpdateLayer}
            onBringToFront={handleBringToFront}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onSendToBack={handleSendToBack}
            onOpenImageEditor={handleOpenImageEditor}
            onDeleteLayer={handleDeleteLayer}
            onUploadFiles={handleUploadImageFiles}
            onFitCanvasToImage={handleFitCanvasToImage}
          />
        </div>

        {/* Columna Derecha: Inspector de Propiedades (3 cols) */}
        {showInspectorPanel && (
          <div className="md:col-span-3 h-full overflow-hidden">
            <LayerProperties
              layer={selectedLayer}
              canvasDimensions={canvasDimensions}
              onUpdateLayer={handleUpdateLayer}
              onBringToFront={handleBringToFront}
              onBringForward={handleBringForward}
              onSendBackward={handleSendBackward}
              onSendToBack={handleSendToBack}
              onOpenImageEditor={handleOpenImageEditor}
              onConvertToImageLayer={handleConvertBackgroundToImage}
              brandColors={brandColors}
              availableBrands={availableBrands}
              onOpenComfyModal={(layerId) => {
                setComfyTargetLayerId(layerId || null);
                setIsComfyModalOpen(true);
              }}
              onFitCanvasToImage={handleFitCanvasToImage}
              onOpenCanvasSizeModal={() => setIsCanvasSizeModalOpen(true)}
            />
          </div>
        )}
      </div>

      {/* MODALES */}
      <CanvasSizeModal
        isOpen={isCanvasSizeModalOpen}
        onClose={() => setIsCanvasSizeModalOpen(false)}
        currentWidth={canvasDimensions.width}
        currentHeight={canvasDimensions.height}
        activeImageDimensions={activeImageDimensions}
        onApply={handleApplyCustomDimensions}
      />
      <PresetsModal
        isOpen={isPresetsModalOpen}
        onClose={() => setIsPresetsModalOpen(false)}
        onSelectTextPreset={handleSelectTextPreset}
        onSelectGraphicPreset={handleSelectGraphicPreset}
        initialTab={presetsInitialTab}
      />

      <ComfyLayerModal
        isOpen={isComfyModalOpen}
        onClose={() => setIsComfyModalOpen(false)}
        targetLayerId={comfyTargetLayerId}
        layers={layers}
        onApplyImageToLayer={handleApplyImageFromComfy}
        canvasSize={canvasDimensions}
        brandContext={brandContext}
      />

      <ComposerTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Modal de Edición & Retoque Raster de Imagen (Pintar, Borrar, Varita Mágica, Recortar, Ajustes) */}
      {isImageEditorOpen && (
        <ImageEditorModal
          isOpen={isImageEditorOpen}
          onClose={() => {
            setIsImageEditorOpen(false);
            setEditingLayerId(null);
            setEditingImageSrc(null);
          }}
          imageSrc={editingImageSrc}
          onSave={handleSaveImageFromEditor}
          brandColors={brandColors}
        />
      )}
    </div>
  );
}
