"use client";

import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  GripHorizontal,
  Lock,
  Maximize,
  Move,
  Paintbrush,
  RotateCcw,
  RotateCw,
  Trash2,
  Unlock,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { renderLayersToCanvas } from "./canvas-renderer";
import { ASPECT_RATIOS, AspectRatioId, CanvasDimensions, CanvasLayer } from "./types";

interface LayerCanvasProps {
  layers: CanvasLayer[];
  selectedLayerId: string | null;
  aspectRatio: AspectRatioId;
  canvasDimensions?: CanvasDimensions;
  brandLogosMap: Record<string, string>;
  isFullscreen?: boolean;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (layerId: string, updates: Partial<CanvasLayer>) => void;
  onBringToFront?: (layerId: string) => void;
  onBringForward?: (layerId: string) => void;
  onSendBackward?: (layerId: string) => void;
  onSendToBack?: (layerId: string) => void;
  onOpenImageEditor?: (layerId: string, imageSrc: string) => void;
  onDeleteLayer?: (layerId: string) => void;
  onUploadFiles?: (files: FileList | File[]) => void;
  onFitCanvasToImage?: (imageUrl?: string) => void;
}

type DragMode =
  | "move"
  | "resize-nw"
  | "resize-ne"
  | "resize-se"
  | "resize-sw"
  | "resize-n"
  | "resize-s"
  | "resize-e"
  | "resize-w"
  | "rotate"
  | null;

export function LayerCanvas({
  layers,
  selectedLayerId,
  aspectRatio,
  canvasDimensions,
  brandLogosMap,
  isFullscreen = false,
  onSelectLayer,
  onUpdateLayer,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onOpenImageEditor,
  onDeleteLayer,
  onUploadFiles,
  onFitCanvasToImage,
}: LayerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dimensions: CanvasDimensions =
    canvasDimensions ||
    (aspectRatio !== "custom" && (ASPECT_RATIOS as any)[aspectRatio]) || {
      width: 1080,
      height: 1080,
      label: "1:1 Cuadrado",
      sublabel: "Instagram / Feed / Facebook",
      iconName: "Square",
    };

  const [zoom, setZoom] = useState(1);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialLayerState, setInitialLayerState] = useState<CanvasLayer | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [lockAspect, setLockAspect] = useState<boolean>(true);

  // Ubicación y arrastre de la barra de herramientas del elemento
  type ToolbarPlacement = "auto" | "dock-bottom" | "dock-top";
  const [toolbarPlacement, setToolbarPlacement] = useState<ToolbarPlacement>("auto");
  const [toolbarOffset, setToolbarOffset] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [toolbarDragStart, setToolbarDragStart] = useState<{
    clientX: number;
    clientY: number;
    initialOffset: { x: number; y: number };
  }>({
    clientX: 0,
    clientY: 0,
    initialOffset: { x: 0, y: 0 },
  });

  // Ubicación y arrastre de la barra de Zoom e información
  const [zoomBarOffset, setZoomBarOffset] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingZoomBar, setIsDraggingZoomBar] = useState(false);
  const [zoomBarDragStart, setZoomBarDragStart] = useState<{
    clientX: number;
    clientY: number;
    initialOffset: { x: number; y: number };
  }>({
    clientX: 0,
    clientY: 0,
    initialOffset: { x: 0, y: 0 },
  });

  // Cargar preferencia persistida de ubicación de barra
  useEffect(() => {
    try {
      const saved = localStorage.getItem("saas_hub_layer_toolbar_placement");
      if (saved === "auto" || saved === "dock-bottom" || saved === "dock-top") {
        setToolbarPlacement(saved as ToolbarPlacement);
      }
    } catch (_) {}
  }, []);

  const changeToolbarPlacement = (placement: ToolbarPlacement) => {
    setToolbarPlacement(placement);
    try {
      localStorage.setItem("saas_hub_layer_toolbar_placement", placement);
    } catch (_) {}
  };

  // Restablecer offset al cambiar de capa para evitar que quede huérfana
  useEffect(() => {
    setToolbarOffset(null);
  }, [selectedLayerId]);

  // Manejador global para mover las barras con el mouse suavemente sin perder foco
  useEffect(() => {
    if (!isDraggingToolbar && !isDraggingZoomBar) return;

    function handleGlobalMove(e: MouseEvent) {
      if (isDraggingToolbar) {
        const factor = toolbarPlacement === "auto" ? Math.max(0.2, zoom) : 1;
        const dx = (e.clientX - toolbarDragStart.clientX) / factor;
        const dy = (e.clientY - toolbarDragStart.clientY) / factor;
        setToolbarOffset({
          x: Math.round(toolbarDragStart.initialOffset.x + dx),
          y: Math.round(toolbarDragStart.initialOffset.y + dy),
        });
      } else if (isDraggingZoomBar) {
        const dx = e.clientX - zoomBarDragStart.clientX;
        const dy = e.clientY - zoomBarDragStart.clientY;
        setZoomBarOffset({
          x: Math.round(zoomBarDragStart.initialOffset.x + dx),
          y: Math.round(zoomBarDragStart.initialOffset.y + dy),
        });
      }
    }

    function handleGlobalUp() {
      setIsDraggingToolbar(false);
      setIsDraggingZoomBar(false);
    }

    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("mouseup", handleGlobalUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalUp);
    };
  }, [isDraggingToolbar, isDraggingZoomBar, toolbarDragStart, zoomBarDragStart, zoom, toolbarPlacement]);

  function startDraggingToolbar(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (toolbarPlacement !== "auto") {
      changeToolbarPlacement("auto");
    }
    setIsDraggingToolbar(true);
    setToolbarDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      initialOffset: toolbarOffset || { x: 0, y: 0 },
    });
  }

  function startDraggingZoomBar(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingZoomBar(true);
    setZoomBarDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      initialOffset: zoomBarOffset || { x: 0, y: 0 },
    });
  }

  // Guías de alineación magnética
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number }>({});

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const selectedIndex = selectedLayer ? layers.findIndex((l) => l.id === selectedLayerId) : -1;
  const isSelectedTop = selectedIndex === layers.length - 1;
  const isSelectedBottom = selectedIndex <= 1; // 0 es background

  // Re-dibujar canvas cuando cambian las capas, dimensiones o logos
  const redraw = useCallback(async () => {
    if (!canvasRef.current) return;
    await renderLayersToCanvas(canvasRef.current, layers, dimensions, brandLogosMap);
  }, [layers, dimensions, brandLogosMap]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Teclado: Atajos de teclado (Supr para borrar, Flechas para mover, [ y ] para subir/bajar capas)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedLayer || selectedLayer.locked) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const step = e.shiftKey ? 10 : 1;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedLayer.type !== "background") {
          onDeleteLayer?.(selectedLayer.id);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onUpdateLayer(selectedLayer.id, { x: selectedLayer.x - step });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onUpdateLayer(selectedLayer.id, { x: selectedLayer.x + step });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onUpdateLayer(selectedLayer.id, { y: selectedLayer.y - step });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onUpdateLayer(selectedLayer.id, { y: selectedLayer.y + step });
      } else if (e.key === "]" || e.key === "PageUp") {
        e.preventDefault();
        if (e.shiftKey) onBringToFront?.(selectedLayer.id);
        else onBringForward?.(selectedLayer.id);
      } else if (e.key === "[" || e.key === "PageDown") {
        e.preventDefault();
        if (e.shiftKey) onSendToBack?.(selectedLayer.id);
        else onSendBackward?.(selectedLayer.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLayer, onDeleteLayer, onUpdateLayer, onBringForward, onBringToFront, onSendBackward, onSendToBack]);

  // Conversión de coordenadas de pantalla del ratón a coordenadas reales del Canvas
  function getCanvasCoords(e: React.MouseEvent): { x: number; y: number } {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  // Detectar clic en el canvas para seleccionar capa
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (dragMode) return;
    const { x, y } = getCanvasCoords(e);

    // Buscar la capa más alta (en orden inverso) bajo el punto de clic
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible || layer.locked) continue;

      if (layer.type === "background") {
        // El fondo siempre cubre todo, lo seleccionamos solo si no hay otro elemento
        continue;
      }

      const left = layer.x;
      const top = layer.y;
      const right = layer.x + layer.width;
      const bottom = layer.y + layer.height;

      if (x >= left && x <= right && y >= top && y <= bottom) {
        onSelectLayer(layer.id);
        startDragging(e, "move", layer);
        return;
      }
    }

    // Si hizo clic en el fondo
    const bgLayer = layers.find((l) => l.type === "background");
    if (bgLayer) {
      onSelectLayer(bgLayer.id);
    } else {
      onSelectLayer(null);
    }
  }

  function startDragging(e: React.MouseEvent, mode: DragMode, layer: CanvasLayer) {
    e.stopPropagation();
    setDragMode(mode);
    setDragStart(getCanvasCoords(e));
    setInitialLayerState({ ...layer });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragMode || !selectedLayer || !initialLayerState || selectedLayer.locked) return;

    const currentCoords = getCanvasCoords(e);
    const dx = currentCoords.x - dragStart.x;
    const dy = currentCoords.y - dragStart.y;
    const isAspectLocked = e.shiftKey ? !lockAspect : lockAspect;
    const ratio = Math.max(0.01, initialLayerState.width / Math.max(1, initialLayerState.height));

    if (dragMode === "move") {
      let newX = Math.round(initialLayerState.x + dx);
      let newY = Math.round(initialLayerState.y + dy);

      // Snap magnético al centro
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const layerCenterX = newX + initialLayerState.width / 2;
      const layerCenterY = newY + initialLayerState.height / 2;

      const guides: { x?: number; y?: number } = {};
      if (Math.abs(layerCenterX - centerX) < 15) {
        newX = centerX - initialLayerState.width / 2;
        guides.x = centerX;
      }
      if (Math.abs(layerCenterY - centerY) < 15) {
        newY = centerY - initialLayerState.height / 2;
        guides.y = centerY;
      }

      setSnapGuides(guides);
      onUpdateLayer(selectedLayer.id, { x: newX, y: newY });
    } else if (dragMode === "resize-se") {
      if (isAspectLocked) {
        const scaleX = (initialLayerState.width + dx) / initialLayerState.width;
        const scaleY = (initialLayerState.height + dy) / initialLayerState.height;
        const scale = Math.abs(scaleX - 1) > Math.abs(scaleY - 1) ? scaleX : scaleY;
        const newW = Math.max(15, Math.round(initialLayerState.width * Math.max(0.05, scale)));
        const newH = Math.max(15, Math.round(newW / ratio));
        onUpdateLayer(selectedLayer.id, { width: newW, height: newH });
      } else {
        const newW = Math.max(15, Math.round(initialLayerState.width + dx));
        const newH = Math.max(15, Math.round(initialLayerState.height + dy));
        onUpdateLayer(selectedLayer.id, { width: newW, height: newH });
      }
    } else if (dragMode === "resize-sw") {
      if (isAspectLocked) {
        const scaleX = (initialLayerState.width - dx) / initialLayerState.width;
        const scaleY = (initialLayerState.height + dy) / initialLayerState.height;
        const scale = Math.abs(scaleX - 1) > Math.abs(scaleY - 1) ? scaleX : scaleY;
        const newW = Math.max(15, Math.round(initialLayerState.width * Math.max(0.05, scale)));
        const newH = Math.max(15, Math.round(newW / ratio));
        const newX = initialLayerState.x + (initialLayerState.width - newW);
        onUpdateLayer(selectedLayer.id, { x: newX, width: newW, height: newH });
      } else {
        const newW = Math.max(15, Math.round(initialLayerState.width - dx));
        const newH = Math.max(15, Math.round(initialLayerState.height + dy));
        const newX = initialLayerState.x + (initialLayerState.width - newW);
        onUpdateLayer(selectedLayer.id, { x: newX, width: newW, height: newH });
      }
    } else if (dragMode === "resize-ne") {
      if (isAspectLocked) {
        const scaleX = (initialLayerState.width + dx) / initialLayerState.width;
        const scaleY = (initialLayerState.height - dy) / initialLayerState.height;
        const scale = Math.abs(scaleX - 1) > Math.abs(scaleY - 1) ? scaleX : scaleY;
        const newW = Math.max(15, Math.round(initialLayerState.width * Math.max(0.05, scale)));
        const newH = Math.max(15, Math.round(newW / ratio));
        const newY = initialLayerState.y + (initialLayerState.height - newH);
        onUpdateLayer(selectedLayer.id, { y: newY, width: newW, height: newH });
      } else {
        const newW = Math.max(15, Math.round(initialLayerState.width + dx));
        const newH = Math.max(15, Math.round(initialLayerState.height - dy));
        const newY = initialLayerState.y + (initialLayerState.height - newH);
        onUpdateLayer(selectedLayer.id, { y: newY, width: newW, height: newH });
      }
    } else if (dragMode === "resize-nw") {
      if (isAspectLocked) {
        const scaleX = (initialLayerState.width - dx) / initialLayerState.width;
        const scaleY = (initialLayerState.height - dy) / initialLayerState.height;
        const scale = Math.abs(scaleX - 1) > Math.abs(scaleY - 1) ? scaleX : scaleY;
        const newW = Math.max(15, Math.round(initialLayerState.width * Math.max(0.05, scale)));
        const newH = Math.max(15, Math.round(newW / ratio));
        const newX = initialLayerState.x + (initialLayerState.width - newW);
        const newY = initialLayerState.y + (initialLayerState.height - newH);
        onUpdateLayer(selectedLayer.id, { x: newX, y: newY, width: newW, height: newH });
      } else {
        const newW = Math.max(15, Math.round(initialLayerState.width - dx));
        const newH = Math.max(15, Math.round(initialLayerState.height - dy));
        const newX = initialLayerState.x + (initialLayerState.width - newW);
        const newY = initialLayerState.y + (initialLayerState.height - newH);
        onUpdateLayer(selectedLayer.id, { x: newX, y: newY, width: newW, height: newH });
      }
    } else if (dragMode === "resize-e") {
      if (isAspectLocked) {
        const newW = Math.max(15, Math.round(initialLayerState.width + dx));
        const newH = Math.max(15, Math.round(newW / ratio));
        const newY = Math.round(initialLayerState.y + (initialLayerState.height - newH) / 2);
        onUpdateLayer(selectedLayer.id, { y: newY, width: newW, height: newH });
      } else {
        const newW = Math.max(15, Math.round(initialLayerState.width + dx));
        onUpdateLayer(selectedLayer.id, { width: newW });
      }
    } else if (dragMode === "resize-w") {
      if (isAspectLocked) {
        const newW = Math.max(15, Math.round(initialLayerState.width - dx));
        const newH = Math.max(15, Math.round(newW / ratio));
        const newX = Math.round(initialLayerState.x + (initialLayerState.width - newW));
        const newY = Math.round(initialLayerState.y + (initialLayerState.height - newH) / 2);
        onUpdateLayer(selectedLayer.id, { x: newX, y: newY, width: newW, height: newH });
      } else {
        const newW = Math.max(15, Math.round(initialLayerState.width - dx));
        const newX = initialLayerState.x + (initialLayerState.width - newW);
        onUpdateLayer(selectedLayer.id, { x: newX, width: newW });
      }
    } else if (dragMode === "resize-s") {
      if (isAspectLocked) {
        const newH = Math.max(15, Math.round(initialLayerState.height + dy));
        const newW = Math.max(15, Math.round(newH * ratio));
        const newX = Math.round(initialLayerState.x + (initialLayerState.width - newW) / 2);
        onUpdateLayer(selectedLayer.id, { x: newX, width: newW, height: newH });
      } else {
        const newH = Math.max(15, Math.round(initialLayerState.height + dy));
        onUpdateLayer(selectedLayer.id, { height: newH });
      }
    } else if (dragMode === "resize-n") {
      if (isAspectLocked) {
        const newH = Math.max(15, Math.round(initialLayerState.height - dy));
        const newW = Math.max(15, Math.round(newH * ratio));
        const newX = Math.round(initialLayerState.x + (initialLayerState.width - newW) / 2);
        const newY = Math.round(initialLayerState.y + (initialLayerState.height - newH));
        onUpdateLayer(selectedLayer.id, { x: newX, y: newY, width: newW, height: newH });
      } else {
        const newH = Math.max(15, Math.round(initialLayerState.height - dy));
        const newY = initialLayerState.y + (initialLayerState.height - newH);
        onUpdateLayer(selectedLayer.id, { y: newY, height: newH });
      }
    } else if (dragMode === "rotate") {
      const layerCenterX = initialLayerState.x + initialLayerState.width / 2;
      const layerCenterY = initialLayerState.y + initialLayerState.height / 2;
      const rad = Math.atan2(currentCoords.y - layerCenterY, currentCoords.x - layerCenterX);
      let deg = Math.round((rad * 180) / Math.PI) + 90;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15; // Snap a 15 grados
      onUpdateLayer(selectedLayer.id, { rotation: deg });
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingFile) setIsDraggingFile(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles?.(e.dataTransfer.files);
    }
  }

  function handleMouseUp() {
    setDragMode(null);
    setInitialLayerState(null);
    setSnapGuides({});
    setIsDraggingToolbar(false);
    setIsDraggingZoomBar(false);
  }

  // Determinar posición inteligente para la barra de herramientas flotante
  const isNearTop = selectedLayer
    ? (selectedLayer.y / dimensions.height) < 0.15 || selectedLayer.y < 80
    : false;
  const layerCenterXPercent = selectedLayer
    ? ((selectedLayer.x + selectedLayer.width / 2) / dimensions.width) * 100
    : 50;
  const layerTopPercent = selectedLayer
    ? (selectedLayer.y / dimensions.height) * 100
    : 0;
  const layerBottomPercent = selectedLayer
    ? ((selectedLayer.y + selectedLayer.height) / dimensions.height) * 100
    : 100;

  // Renderizado dinámico de la barra de herramientas del elemento (soporta modo flotante y acoplado)
  const renderToolbar = (isFloatingMode: boolean) => {
    if (!selectedLayer || selectedLayer.type === "background") return null;

    return (
      <div
        className={`flex items-center gap-1 bg-zinc-950/95 backdrop-blur-md px-2 py-1 rounded-lg border border-zinc-700/80 shadow-[0_10px_35px_rgba(0,0,0,0.7)] pointer-events-auto select-none text-xs text-zinc-300 ${
          isFloatingMode ? "" : "animate-in fade-in zoom-in-95 duration-150"
        }`}
      >
        {/* Grip de arrastre para mover la barra libremente */}
        <div
          onMouseDown={startDraggingToolbar}
          onDoubleClick={() => setToolbarOffset(null)}
          className="cursor-grab active:cursor-grabbing flex items-center gap-1 px-1.5 py-0.5 text-zinc-500 hover:text-cyan-400 rounded hover:bg-zinc-900 transition-colors group"
          title="Arrastrar barra de herramientas para moverla libremente (Doble clic para restablecer)"
        >
          <GripHorizontal className="w-4 h-4" />
          <span className="text-[10px] font-medium text-zinc-400 group-hover:text-cyan-300 hidden sm:inline max-w-[85px] truncate">
            {selectedLayer.name || "Capa"}
          </span>
        </div>

        <div className="w-[1px] h-3.5 bg-zinc-800 mx-0.5" />

        {/* Botón Llenar Lienzo */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUpdateLayer(selectedLayer.id, {
              x: 0,
              y: 0,
              width: dimensions.width,
              height: dimensions.height,
              ...(selectedLayer.type === "image" ? { objectFit: "cover" } : {}),
            });
            toast.success("Capa ajustada a todo el lienzo");
          }}
          className="p-1 hover:bg-amber-950/60 rounded text-amber-300 hover:text-amber-200 flex items-center gap-1 text-[11px] font-medium transition-colors"
          title="Ajustar y cubrir todo el lienzo"
        >
          <Maximize className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Llenar</span>
        </button>

        {/* Botón Ajustar Lienzo al tamaño exacto de esta imagen */}
        {selectedLayer.type === "image" && onFitCanvasToImage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFitCanvasToImage((selectedLayer as any).imageUrl);
            }}
            className="p-1 hover:bg-amber-950/60 rounded text-amber-300 hover:text-amber-200 flex items-center gap-1 text-[11px] font-medium transition-colors"
            title="Ajustar dimensiones del lienzo exactamente al tamaño de esta imagen (elimina cualquier borde)"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Ajustar Lienzo</span>
          </button>
        )}

        {/* Botón Centrar */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUpdateLayer(selectedLayer.id, {
              x: Math.round((dimensions.width - selectedLayer.width) / 2),
              y: Math.round((dimensions.height - selectedLayer.height) / 2),
            });
            toast.success("Capa centrada en el lienzo");
          }}
          className="p-1 hover:bg-cyan-950/60 rounded text-cyan-300 hover:text-cyan-200 flex items-center gap-1 text-[11px] transition-colors"
          title="Centrar en el lienzo horizontal y verticalmente"
        >
          <Move className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Centrar</span>
        </button>

        <div className="w-[1px] h-3.5 bg-zinc-800 mx-0.5" />

        {/* Toggle Proporción Bloqueada vs Libre */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLockAspect((prev) => !prev);
            toast.info(
              !lockAspect
                ? "Proporción bloqueada (no se deforma)"
                : "Proporción libre (puedes estirar ancho y alto libremente)"
            );
          }}
          className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px] font-medium transition-colors ${
            lockAspect
              ? "bg-amber-500/20 border border-amber-500/50 text-amber-300 font-semibold"
              : "bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-200"
          }`}
          title={
            lockAspect
              ? "Proporción bloqueada (no se deforma). Clic para libre (o mantén Shift al arrastrar)"
              : "Proporción libre (puedes estirar). Clic para bloquear proporción"
          }
        >
          {lockAspect ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3 text-zinc-400" />}
          <span className="hidden sm:inline">{lockAspect ? "Proporcional" : "Libre"}</span>
        </button>

        {/* Botón de Retoque si es capa de imagen */}
        {selectedLayer.type === "image" && (selectedLayer as any).imageUrl && (
          <>
            <div className="w-[1px] h-3.5 bg-zinc-800 mx-0.5" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenImageEditor?.(selectedLayer.id, (selectedLayer as any).imageUrl);
              }}
              className="p-1 hover:bg-amber-950/60 rounded text-amber-300 hover:text-amber-200 flex items-center gap-1 text-[10px] transition-colors"
              title="Pintar, borrar fondo, usar varita mágica o recortar imagen"
            >
              <Paintbrush className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Retocar</span>
            </button>
          </>
        )}

        <div className="w-[1px] h-3.5 bg-zinc-800 mx-0.5" />

        {/* Orden Z-Index */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={isSelectedTop}
            onClick={(e) => {
              e.stopPropagation();
              onBringToFront?.(selectedLayer.id);
            }}
            className="p-1 hover:bg-cyan-950/60 rounded text-zinc-300 hover:text-cyan-300 disabled:opacity-25 disabled:pointer-events-none flex items-center text-[10px]"
            title="Traer al Frente"
          >
            <ChevronsUp className="w-3.5 h-3.5 text-cyan-400" />
          </button>
          <button
            type="button"
            disabled={isSelectedTop}
            onClick={(e) => {
              e.stopPropagation();
              onBringForward?.(selectedLayer.id);
            }}
            className="p-1 hover:bg-cyan-950/60 rounded text-zinc-300 hover:text-cyan-300 disabled:opacity-25 disabled:pointer-events-none flex items-center text-[10px]"
            title="Traer Adelante (subir 1 capa)"
          >
            <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
          </button>
          <button
            type="button"
            disabled={isSelectedBottom}
            onClick={(e) => {
              e.stopPropagation();
              onSendBackward?.(selectedLayer.id);
            }}
            className="p-1 hover:bg-cyan-950/60 rounded text-zinc-300 hover:text-cyan-300 disabled:opacity-25 disabled:pointer-events-none flex items-center text-[10px]"
            title="Enviar Atrás (bajar 1 capa)"
          >
            <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
          </button>
          <button
            type="button"
            disabled={isSelectedBottom}
            onClick={(e) => {
              e.stopPropagation();
              onSendToBack?.(selectedLayer.id);
            }}
            className="p-1 hover:bg-cyan-950/60 rounded text-zinc-300 hover:text-cyan-300 disabled:opacity-25 disabled:pointer-events-none flex items-center text-[10px]"
            title="Enviar al Fondo"
          >
            <ChevronsDown className="w-3.5 h-3.5 text-cyan-400" />
          </button>
        </div>

        <div className="w-[1px] h-3.5 bg-zinc-800 mx-0.5" />

        {/* Reordenar / Ubicación de la barra de herramientas */}
        <div className="flex items-center bg-zinc-900 rounded p-0.5 border border-zinc-800 gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              changeToolbarPlacement("auto");
              toast.info("Barra en modo flotante (puedes arrastrarla libremente)");
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors ${
              toolbarPlacement === "auto"
                ? "bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Modo Flotante: sigue al objeto y puedes moverla arrastrando a cualquier lugar"
          >
            <GripHorizontal className="w-3 h-3" />
            <span className="hidden lg:inline text-[9px]">Flotante</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              changeToolbarPlacement("dock-bottom");
              toast.info("Barra fijada abajo (no tapa el diseño)");
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors ${
              toolbarPlacement === "dock-bottom"
                ? "bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Fijar Abajo: la barra se ancla al pie del visor, sin tapar nunca la imagen"
          >
            <ArrowDownToLine className="w-3 h-3" />
            <span className="hidden lg:inline text-[9px]">Fijar Abajo</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              changeToolbarPlacement("dock-top");
              toast.info("Barra fijada arriba");
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors ${
              toolbarPlacement === "dock-top"
                ? "bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Fijar Arriba: la barra se ancla en la parte superior derecha"
          >
            <ArrowUpToLine className="w-3 h-3" />
            <span className="hidden lg:inline text-[9px]">Fijar Arriba</span>
          </button>
        </div>

        {/* Botón de restablecer posición si fue arrastrada */}
        {toolbarOffset && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setToolbarOffset(null);
              toast.info("Posición de la barra restablecida");
            }}
            className="p-1 hover:bg-zinc-800 rounded text-amber-400 hover:text-amber-300 transition-colors"
            title="Restablecer posición de la barra junto al elemento"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        <div className="w-[1px] h-3.5 bg-zinc-800 mx-0.5" />

        {/* Eliminar capa */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteLayer?.(selectedLayer.id);
          }}
          className="p-1 hover:bg-red-950/60 rounded text-zinc-400 hover:text-red-400 transition-colors"
          title="Eliminar capa seleccionada (Supr)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 flex flex-col items-center justify-center bg-zinc-950/80 p-3 md:p-5 rounded-xl border transition-colors overflow-hidden select-none ${
        isDraggingFile ? "border-cyan-400 bg-cyan-950/20" : "border-zinc-800/80"
      }`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Overlay Visual de Arrastrar y Soltar Imagen */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 bg-cyan-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 border-2 border-dashed border-cyan-400 m-2 rounded-xl pointer-events-none animate-in fade-in duration-150">
          <div className="p-4 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <Maximize className="w-8 h-8 animate-bounce" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Soltá tu imagen aquí
          </h3>
          <p className="text-xs text-cyan-200 mt-1">
            Se agregará instantáneamente como una nueva capa a tu flyer.
          </p>
        </div>
      )}

      {/* Barra de herramientas flotante de Zoom y Dimensiones (Arrastrable y Reubicable) */}
      <div
        style={{
          transform: zoomBarOffset ? `translate(${zoomBarOffset.x}px, ${zoomBarOffset.y}px)` : undefined,
        }}
        className="absolute top-3 left-3 z-30 flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-300 shadow-xl select-none"
      >
        <div
          onMouseDown={startDraggingZoomBar}
          onDoubleClick={() => setZoomBarOffset(null)}
          className="cursor-grab active:cursor-grabbing p-0.5 text-zinc-500 hover:text-cyan-400 rounded transition-colors"
          title="Arrastrar para mover barra de Zoom y Dimensiones (Doble clic para restablecer)"
        >
          <GripHorizontal className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold text-zinc-200">{dimensions.label}</span>
        <span className="text-zinc-500">|</span>
        <span className="text-zinc-400">
          {dimensions.width}×{dimensions.height}px
        </span>
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-zinc-800">
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
            title="Alejar"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-1 font-mono text-[11px] text-zinc-400">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
            title="Acercar"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
            title="Ajustar 100%"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
          {zoomBarOffset && (
            <button
              onClick={() => setZoomBarOffset(null)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-amber-400 transition-colors"
              title="Restablecer posición de la barra de zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Viewport del Canvas con Zoom */}
      <div
        className="relative flex items-center justify-center transition-transform duration-100 ease-out"
        style={{
          transform: `scale(${zoom})`,
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {/* Contenedor que encierra estrictamente el Canvas y las Guías/Bounding Box */}
        <div
          className="relative rounded-md shadow-2xl border border-zinc-800/80 bg-zinc-900 overflow-visible"
          style={{
            aspectRatio: `${dimensions.width} / ${dimensions.height}`,
            maxHeight: isFullscreen ? "85vh" : "70vh",
            maxWidth: isFullscreen ? "75vw" : "62vw",
          }}
        >
          {/* Canvas de renderizado */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            className="block w-full h-full object-contain cursor-crosshair rounded-md"
          />

          {/* Guías magnéticas de alineación */}
          {snapGuides.x !== undefined && (
            <div
              className="absolute top-0 bottom-0 w-[1.5px] bg-cyan-400 z-30 shadow-[0_0_8px_#22d3ee] pointer-events-none"
              style={{
                left: `${(snapGuides.x / dimensions.width) * 100}%`,
              }}
            />
          )}
          {snapGuides.y !== undefined && (
            <div
              className="absolute left-0 right-0 h-[1.5px] bg-cyan-400 z-30 shadow-[0_0_8px_#22d3ee] pointer-events-none"
              style={{
                top: `${(snapGuides.y / dimensions.height) * 100}%`,
              }}
            />
          )}

          {/* Bounding Box y Handles interactivos sobre la capa activa */}
          {selectedLayer && selectedLayer.type !== "background" && (
            <div
              style={{
                position: "absolute",
                left: `${(selectedLayer.x / dimensions.width) * 100}%`,
                top: `${(selectedLayer.y / dimensions.height) * 100}%`,
                width: `${(selectedLayer.width / dimensions.width) * 100}%`,
                height: `${(selectedLayer.height / dimensions.height) * 100}%`,
                transform: selectedLayer.rotation ? `rotate(${selectedLayer.rotation}deg)` : "none",
                transformOrigin: "center center",
              }}
              className="z-20 pointer-events-none"
            >
              <div className="absolute inset-0 border-[1.5px] border-cyan-400/85 pointer-events-auto">


                {/* Palanca de Rotación superior centrada (estilo Figma/Canva) */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                  <div
                    onMouseDown={(e) => startDragging(e, "rotate", selectedLayer)}
                    className="w-4 h-4 bg-zinc-950 border border-cyan-400 text-cyan-400 rounded-full flex items-center justify-center cursor-grab hover:scale-125 transition-transform shadow-md"
                    title="Rotar capa (mantén Shift para saltos de 15°)"
                  >
                    <RotateCw className="w-2.5 h-2.5" />
                  </div>
                  <div className="w-[1px] h-2 bg-cyan-400/80" />
                </div>

                {/* Tiradores de redimensionado en las 4 esquinas (Sleek Figma style) */}
                <div
                  onMouseDown={(e) => startDragging(e, "resize-nw", selectedLayer)}
                  className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-[1.5px] border-cyan-500 rounded-[2px] cursor-nwse-resize shadow-sm hover:scale-125 hover:bg-cyan-100 transition-transform pointer-events-auto"
                  title={lockAspect ? "Redimensionar esquina (proporcional)" : "Redimensionar esquina (libre)"}
                />
                <div
                  onMouseDown={(e) => startDragging(e, "resize-ne", selectedLayer)}
                  className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-[1.5px] border-cyan-500 rounded-[2px] cursor-nesw-resize shadow-sm hover:scale-125 hover:bg-cyan-100 transition-transform pointer-events-auto"
                  title={lockAspect ? "Redimensionar esquina (proporcional)" : "Redimensionar esquina (libre)"}
                />
                <div
                  onMouseDown={(e) => startDragging(e, "resize-sw", selectedLayer)}
                  className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-[1.5px] border-cyan-500 rounded-[2px] cursor-nesw-resize shadow-sm hover:scale-125 hover:bg-cyan-100 transition-transform pointer-events-auto"
                  title={lockAspect ? "Redimensionar esquina (proporcional)" : "Redimensionar esquina (libre)"}
                />
                <div
                  onMouseDown={(e) => startDragging(e, "resize-se", selectedLayer)}
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-[1.5px] border-cyan-500 rounded-[2px] cursor-nwse-resize shadow-sm hover:scale-125 hover:bg-cyan-100 transition-transform pointer-events-auto"
                  title={lockAspect ? "Redimensionar esquina (proporcional)" : "Redimensionar esquina (libre)"}
                />

                {/* Tiradores en los 4 bordes medios (solo si el objeto es suficientemente amplio) */}
                {selectedLayer.width >= 50 && selectedLayer.height >= 50 && (
                  <>
                    <div
                      onMouseDown={(e) => startDragging(e, "resize-n", selectedLayer)}
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-3.5 h-1.5 bg-white border border-cyan-500 rounded-sm cursor-ns-resize shadow-sm hover:scale-125 hover:bg-cyan-100 transition-transform pointer-events-auto"
                      title="Ajustar altura superior"
                    />
                    <div
                      onMouseDown={(e) => startDragging(e, "resize-s", selectedLayer)}
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-1.5 bg-white border border-cyan-500 rounded-sm cursor-ns-resize shadow-sm hover:scale-125 hover:bg-cyan-100 transition-transform pointer-events-auto"
                      title="Ajustar altura inferior"
                    />
                    <div
                      onMouseDown={(e) => startDragging(e, "resize-w", selectedLayer)}
                      className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-3.5 bg-white border border-cyan-500 rounded-sm cursor-ew-resize shadow-sm hover:scale-125 hover:bg-cyan-100 transition-transform pointer-events-auto"
                      title="Ajustar ancho izquierdo"
                    />
                    <div
                      onMouseDown={(e) => startDragging(e, "resize-e", selectedLayer)}
                      className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-3.5 bg-white border border-cyan-500 rounded-sm cursor-ew-resize shadow-sm hover:scale-125 hover:bg-cyan-100 transition-transform pointer-events-auto"
                      title="Ajustar ancho derecho"
                    />
                  </>
                )}

                {/* Icono central de movimiento transparente */}
                <div
                  onMouseDown={(e) => startDragging(e, "move", selectedLayer)}
                  className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-cyan-500/5 cursor-move transition-opacity pointer-events-auto"
                >
                  <div className="bg-zinc-900/90 text-cyan-400 p-1 rounded-md border border-cyan-500/40 shadow">
                    <Move className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Barra de herramientas contextual flotante inteligente (Auto-reubica abajo si está en borde superior, y arrastrable) */}
          {selectedLayer && selectedLayer.type !== "background" && toolbarPlacement === "auto" && (
            <div
              style={{
                position: "absolute",
                left: `${layerCenterXPercent}%`,
                ...(isNearTop
                  ? { top: `calc(${layerBottomPercent}% + 14px)` }
                  : { bottom: `calc(${100 - layerTopPercent}% + 14px)` }),
                transform: `translate(calc(-50% + ${toolbarOffset?.x || 0}px), ${toolbarOffset?.y || 0}px)`,
              }}
              className="z-40 pointer-events-auto whitespace-nowrap"
            >
              {renderToolbar(true)}
            </div>
          )}
        </div>
      </div>

      {/* Barra de herramientas acoplada abajo (Garantizado: nunca tapa ninguna parte del diseño) */}
      {selectedLayer && selectedLayer.type !== "background" && toolbarPlacement === "dock-bottom" && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 whitespace-nowrap max-w-[95vw] overflow-x-auto p-1">
          {renderToolbar(false)}
        </div>
      )}

      {/* Barra de herramientas acoplada arriba a la derecha */}
      {selectedLayer && selectedLayer.type !== "background" && toolbarPlacement === "dock-top" && (
        <div className="absolute top-3 right-3 z-40 whitespace-nowrap max-w-[95vw] overflow-x-auto p-1">
          {renderToolbar(false)}
        </div>
      )}

      {/* Ayuda rápida en el pie */}
      <div className="absolute bottom-2 right-3 z-10 text-[11px] text-zinc-500 flex items-center gap-3">
        <span>🖱️ Clic para seleccionar</span>
        <span>↔️ Arrastrar para mover</span>
        <span>🔒 Shift: Alternar proporción</span>
        <span>⌨️ Flechas para ajustar</span>
        <span>⌫ Supr para eliminar</span>
      </div>
    </div>
  );
}
