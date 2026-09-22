"use client";

import { Button } from "@/components/ui/button";
import {
  Award,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Lock,
  Sparkles,
  Square,
  Trash2,
  Type,
  Unlock,
  Upload,
} from "lucide-react";
import React, { useState } from "react";
import { CanvasLayer, LayerType } from "./types";

interface LayerListProps {
  layers: CanvasLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (layerId: string, updates: Partial<CanvasLayer>) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  onBringToFront?: (layerId: string) => void;
  onBringForward?: (layerId: string) => void;
  onSendBackward?: (layerId: string) => void;
  onSendToBack?: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onAddLayer: (type: LayerType) => void;
  onOpenComfyModal: (targetLayerId?: string) => void;
  onUploadFileClick?: () => void;
  onOpenPresetsModal?: (tab?: "text" | "graphics") => void;
}

export function LayerList({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onReorderLayers,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onDuplicateLayer,
  onDeleteLayer,
  onAddLayer,
  onOpenComfyModal,
  onUploadFileClick,
  onOpenPresetsModal,
}: LayerListProps) {
  // Mostramos las capas en orden visual descendente (la capa superior arriba de la lista)
  const displayLayers = [...layers].map((layer, index) => ({ layer, index })).reverse();
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const selectedIndex = selectedLayer ? layers.findIndex((l) => l.id === selectedLayerId) : -1;

  const isSelectedTop = selectedIndex === layers.length - 1;
  const isSelectedBottom = selectedIndex <= 1; // 0 es background

  // Estados para Drag & Drop interactivo de capas
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: "above" | "below" } | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number, isBg: boolean) {
    if (isBg) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "above" : "below";
    setDropTarget({ index, position });
  }

  function handleDragLeave() {
    setDropTarget(null);
  }

  function handleDrop(e: React.DragEvent, targetIndex: number, isBg: boolean) {
    e.preventDefault();
    setDropTarget(null);
    const fromIdxStr = e.dataTransfer.getData("text/plain");
    const fromIdx = draggedIndex !== null ? draggedIndex : parseInt(fromIdxStr, 10);
    setDraggedIndex(null);

    if (isNaN(fromIdx) || fromIdx === targetIndex || isBg) return;
    if (fromIdx <= 0) return; // Background protegido en índice 0

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const isAbove = e.clientY < midY;

    // En la lista visual, "above" es hacia arriba (mayor z-index)
    // "below" es hacia abajo (menor z-index)
    let toIndex = targetIndex;
    if (isAbove) {
      toIndex = fromIdx < targetIndex ? targetIndex : targetIndex + 1;
    } else {
      toIndex = fromIdx < targetIndex ? targetIndex - 1 : targetIndex;
    }

    toIndex = Math.max(1, Math.min(layers.length - 1, toIndex));
    if (toIndex !== fromIdx) {
      onReorderLayers(fromIdx, toIndex);
    }
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDropTarget(null);
  }

  function getLayerIcon(layer: CanvasLayer) {
    switch (layer.type) {
      case "background":
        return <Square className="w-3.5 h-3.5 text-zinc-400" />;
      case "text":
        return <Type className="w-3.5 h-3.5 text-amber-400" />;
      case "image":
        return <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />;
      case "shape":
        return <Sparkles className="w-3.5 h-3.5 text-emerald-400" />;
      case "brand-logo":
        return <Award className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-zinc-400" />;
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
      {/* Cabecera del Panel de Capas */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Capas ({layers.length})
          </span>
        </div>
      </div>

      {/* Botones rápidos para agregar capas (Foto, Logo, Letras, Formas, IA) */}
      <div className="p-2 border-b border-zinc-800/80 bg-zinc-900/60 grid grid-cols-5 gap-1 text-xs">
        <Button
          variant="outline"
          size="sm"
          onClick={onUploadFileClick}
          className="h-8 px-1 bg-amber-950/40 border-amber-800/50 hover:bg-amber-900/50 hover:border-amber-500/60 text-amber-300 text-[10px] gap-0.5 font-semibold flex-col justify-center sm:flex-row sm:gap-1"
          title="Subir imagen o foto desde tu ordenador"
        >
          <Upload className="w-3 h-3 text-amber-400" />
          <span className="truncate">+ Foto</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddLayer("brand-logo")}
          className="h-8 px-1 bg-purple-950/40 border-purple-800/50 hover:bg-purple-900/50 hover:border-purple-500/60 text-purple-300 text-[10px] gap-0.5 font-semibold flex-col justify-center sm:flex-row sm:gap-1"
          title="Agregar Logo de Marca"
        >
          <Award className="w-3 h-3 text-purple-400" />
          <span className="truncate">+ Logo</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => (onOpenPresetsModal ? onOpenPresetsModal("text") : onAddLayer("text"))}
          className="h-8 px-1 bg-zinc-950/60 border-zinc-800 hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-300 text-zinc-300 text-[10px] gap-0.5 flex-col justify-center sm:flex-row sm:gap-1"
          title="Agregar Letras / Tipografías estilizadas"
        >
          <Type className="w-3 h-3 text-amber-400" />
          <span className="truncate">+ Letras</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => (onOpenPresetsModal ? onOpenPresetsModal("graphics") : onAddLayer("shape"))}
          className="h-8 px-1 bg-zinc-950/60 border-zinc-800 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-300 text-zinc-300 text-[10px] gap-0.5 flex-col justify-center sm:flex-row sm:gap-1"
          title="Agregar Formas, Badges y Efectos"
        >
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span className="truncate">+ Formas</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenComfyModal()}
          className="h-8 px-1 bg-gradient-to-r from-cyan-950/50 to-blue-950/50 border-cyan-700/50 hover:border-cyan-400 text-cyan-300 text-[10px] gap-0.5 shadow-sm flex-col justify-center sm:flex-row sm:gap-1"
          title="Generar Capa con ComfyUI / IA"
        >
          <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span className="truncate">+ IA</span>
        </Button>
      </div>

      {/* Barra de Reordenamiento Rápido Z-Index cuando hay una capa seleccionada */}
      {selectedLayer && selectedLayer.type !== "background" && (
        <div className="p-2 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-1 text-[11px]">
          <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
            Posición:
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={isSelectedTop}
              onClick={() => onBringToFront?.(selectedLayer.id)}
              className="px-1.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-cyan-950/50 hover:border-cyan-500/50 text-zinc-300 hover:text-cyan-300 disabled:opacity-30 flex items-center gap-0.5 text-[10px]"
              title="Traer al Frente (Máxima prioridad)"
            >
              <ChevronsUp className="w-3 h-3 text-cyan-400" />
              Al Frente
            </button>

            <button
              disabled={isSelectedTop}
              onClick={() => onBringForward?.(selectedLayer.id)}
              className="px-1.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-cyan-950/50 hover:border-cyan-500/50 text-zinc-300 hover:text-cyan-300 disabled:opacity-30 flex items-center gap-0.5 text-[10px]"
              title="Traer Adelante (Subir 1 nivel)"
            >
              <ChevronUp className="w-3 h-3 text-cyan-400" />
              Adelante
            </button>

            <button
              disabled={isSelectedBottom}
              onClick={() => onSendBackward?.(selectedLayer.id)}
              className="px-1.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-cyan-950/50 hover:border-cyan-500/50 text-zinc-300 hover:text-cyan-300 disabled:opacity-30 flex items-center gap-0.5 text-[10px]"
              title="Enviar Atrás (Bajar 1 nivel)"
            >
              <ChevronDown className="w-3 h-3 text-cyan-400" />
              Atrás
            </button>

            <button
              disabled={isSelectedBottom}
              onClick={() => onSendToBack?.(selectedLayer.id)}
              className="px-1.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-cyan-950/50 hover:border-cyan-500/50 text-zinc-300 hover:text-cyan-300 disabled:opacity-30 flex items-center gap-0.5 text-[10px]"
              title="Enviar al Fondo (Detrás de todo, sobre el fondo)"
            >
              <ChevronsDown className="w-3 h-3 text-cyan-400" />
              Al Fondo
            </button>
          </div>
        </div>
      )}

      {/* Lista de Capas */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {displayLayers.map(({ layer, index }) => {
          const isSelected = layer.id === selectedLayerId;
          const isBottom = index <= 1;
          const isTop = index === layers.length - 1;
          const isBg = layer.type === "background";
          const isDraggingThis = draggedIndex === index;
          const isDropTargetAbove = dropTarget?.index === index && dropTarget.position === "above";
          const isDropTargetBelow = dropTarget?.index === index && dropTarget.position === "below";

          return (
            <div
              key={layer.id}
              draggable={!isBg}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index, isBg)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index, isBg)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectLayer(layer.id)}
              className={`group relative flex flex-col p-2 rounded-lg border transition-all cursor-pointer select-none ${
                isDraggingThis ? "opacity-30 scale-[0.98]" : ""
              } ${
                isDropTargetAbove
                  ? "border-t-2 border-t-cyan-400 shadow-[0_-3px_10px_rgba(34,211,238,0.5)]"
                  : isDropTargetBelow
                  ? "border-b-2 border-b-cyan-400 shadow-[0_3px_10px_rgba(34,211,238,0.5)]"
                  : isSelected
                  ? "bg-cyan-950/40 border-cyan-500/80 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                  : "bg-zinc-950/40 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700"
              } ${!layer.visible ? "opacity-40" : ""}`}
            >
              {/* Fila principal: Tirador Drag, Icono, Nombre y Acciones Rápidas */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {!isBg && (
                    <div
                      className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-cyan-400 p-0.5"
                      title="Arrastrar arriba o abajo para reordenar capas"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="p-1 rounded bg-zinc-900 border border-zinc-800">
                    {getLayerIcon(layer)}
                  </div>
                  <input
                    type="text"
                    value={layer.name}
                    onChange={(e) => onUpdateLayer(layer.id, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-none focus:outline-none focus:bg-zinc-900/80 rounded px-1 text-xs text-zinc-200 font-medium truncate w-full"
                  />
                </div>

                {/* Controles de Capa: Visibilidad, Bloqueo, Reordenar */}
                <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                  {/* Visibilidad */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateLayer(layer.id, { visible: !layer.visible });
                    }}
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
                    title={layer.visible ? "Ocultar capa" : "Mostrar capa"}
                  >
                    {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-600" />}
                  </button>

                  {/* Bloqueo */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateLayer(layer.id, { locked: !layer.locked });
                    }}
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
                    title={layer.locked ? "Desbloquear capa" : "Bloquear capa"}
                  >
                    {layer.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  {/* Subir de orden (Traer adelante) */}
                  {layer.type !== "background" && (
                    <button
                      disabled={isTop}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isTop) onBringForward?.(layer.id);
                      }}
                      className="p-1 hover:bg-zinc-800 disabled:opacity-20 rounded text-zinc-400 hover:text-cyan-300"
                      title="Traer adelante (subir 1 nivel)"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Bajar de orden (Enviar atrás) */}
                  {layer.type !== "background" && (
                    <button
                      disabled={isBottom}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isBottom) onSendBackward?.(layer.id);
                      }}
                      className="p-1 hover:bg-zinc-800 disabled:opacity-20 rounded text-zinc-400 hover:text-cyan-300"
                      title="Enviar atrás (bajar 1 nivel)"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Controles expandidos si está seleccionada */}
              {isSelected && (
                <div
                  className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Slider de Opacidad */}
                  <div className="flex items-center gap-1.5 flex-1 mr-2">
                    <span>Op:</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={layer.opacity ?? 1}
                      onChange={(e) => onUpdateLayer(layer.id, { opacity: parseFloat(e.target.value) })}
                      className="w-16 h-1 accent-cyan-400 cursor-pointer"
                    />
                    <span className="text-[10px] text-zinc-400 font-mono w-7 text-right">
                      {Math.round((layer.opacity ?? 1) * 100)}%
                    </span>
                  </div>

                  {/* Duplicar / Eliminar */}
                  <div className="flex items-center gap-1">
                    {layer.type !== "background" && (
                      <>
                        <button
                          onClick={() => onDuplicateLayer(layer.id)}
                          className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-cyan-300"
                          title="Duplicar capa"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteLayer(layer.id)}
                          className="p-1 hover:bg-red-950/60 rounded text-zinc-400 hover:text-red-400"
                          title="Eliminar capa"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
