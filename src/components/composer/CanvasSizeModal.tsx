"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeftRight,
  Check,
  Expand,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Sliders,
  Unlock,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { CanvasPresetOption, POPULAR_CANVAS_PRESETS } from "./types";

interface CanvasSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWidth: number;
  currentHeight: number;
  activeImageDimensions?: { width: number; height: number; name?: string } | null;
  onApply: (params: {
    width: number;
    height: number;
    fitBackground: boolean;
    fitImage: boolean;
  }) => void;
}

export function CanvasSizeModal({
  isOpen,
  onClose,
  currentWidth,
  currentHeight,
  activeImageDimensions,
  onApply,
}: CanvasSizeModalProps) {
  const [width, setWidth] = useState(currentWidth);
  const [height, setHeight] = useState(currentHeight);
  const [lockRatio, setLockRatio] = useState(false);
  const [ratio, setRatio] = useState(currentWidth / (currentHeight || 1));
  const [fitBackground, setFitBackground] = useState(true);
  const [fitImage, setFitImage] = useState(true);

  // Sincronizar estado cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setWidth(currentWidth);
      setHeight(currentHeight);
      setRatio(currentWidth / (currentHeight || 1));
    }
  }, [isOpen, currentWidth, currentHeight]);

  if (!isOpen) return null;

  function handleWidthChange(val: number) {
    const newW = Math.max(100, Math.min(3840, val || 100));
    setWidth(newW);
    if (lockRatio) {
      setHeight(Math.round(newW / (ratio || 1)));
    } else {
      setRatio(newW / (height || 1));
    }
  }

  function handleHeightChange(val: number) {
    const newH = Math.max(100, Math.min(3840, val || 100));
    setHeight(newH);
    if (lockRatio) {
      setWidth(Math.round(newH * (ratio || 1)));
    } else {
      setRatio(width / (newH || 1));
    }
  }

  function handleSwapOrientation() {
    const prevW = width;
    const prevH = height;
    setWidth(prevH);
    setHeight(prevW);
    setRatio(prevH / (prevW || 1));
  }

  function handleSelectPreset(preset: CanvasPresetOption) {
    setWidth(preset.width);
    setHeight(preset.height);
    setRatio(preset.width / preset.height);
  }

  function handleFitToImage() {
    if (!activeImageDimensions) return;
    let targetW = activeImageDimensions.width;
    let targetH = activeImageDimensions.height;

    // Normalizar si excede límites de alta resolución manteniendo proporción exacta
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

    setWidth(targetW);
    setHeight(targetH);
    setRatio(targetW / targetH);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onApply({
      width: Math.round(width),
      height: Math.round(height),
      fitBackground,
      fitImage,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-925 border border-zinc-800 p-6 shadow-2xl space-y-5 text-zinc-100">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Dimensiones y Encuadre del Lienzo
              </h3>
              <p className="text-[11px] text-zinc-400">
                Personalizá las medidas en píxeles o adaptá el lienzo a la resolución de tu imagen.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Botón de Ajuste Instantáneo a la Imagen Activa */}
          {activeImageDimensions && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-cyan-950/30 border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-amber-300 truncate">
                    Imagen detectada: {activeImageDimensions.name || "Foto"}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    {activeImageDimensions.width} × {activeImageDimensions.height} px
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleFitToImage}
                className="h-7 px-3 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold gap-1.5 shadow-md shrink-0"
              >
                <Zap className="w-3 h-3" />
                Ajustar a Imagen
              </Button>
            </div>
          )}

          {/* Inputs Numéricos de Ancho x Alto */}
          <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
            <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Medidas Personalizadas (px)
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <span className="text-[10px] text-zinc-500 font-medium">Ancho (px)</span>
                <Input
                  type="number"
                  min={100}
                  max={3840}
                  value={width}
                  onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                  className="h-9 text-xs font-mono bg-zinc-900 border-zinc-750 text-white focus:border-amber-500"
                />
              </div>

              {/* Botón Candado (Bloqueo de Proporción) */}
              <div className="flex flex-col items-center justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setLockRatio(!lockRatio);
                    setRatio(width / (height || 1));
                  }}
                  className={`p-2 rounded-lg border transition-all ${
                    lockRatio
                      ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                  title={
                    lockRatio
                      ? "Proporción bloqueada (cambiar una medida actualiza la otra)"
                      : "Bloquear proporción de aspecto"
                  }
                >
                  {lockRatio ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex-1">
                <span className="text-[10px] text-zinc-500 font-medium">Alto (px)</span>
                <Input
                  type="number"
                  min={100}
                  max={3840}
                  value={height}
                  onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                  className="h-9 text-xs font-mono bg-zinc-900 border-zinc-750 text-white focus:border-amber-500"
                />
              </div>

              {/* Botón Intercambiar Orientación */}
              <div className="flex flex-col items-center justify-end pt-4">
                <button
                  type="button"
                  onClick={handleSwapOrientation}
                  className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                  title="Intercambiar ancho ↔ alto (horizontal / vertical)"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="text-[10px] text-zinc-500 flex items-center justify-between">
              <span>Proporción: {(width / (height || 1)).toFixed(2)}:1</span>
              <span>Límites: 100px — 3840px (Ultra HD)</span>
            </div>
          </div>

          {/* Cuadrícula de Presets Populares */}
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Formatos y Redes Populares
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {POPULAR_CANVAS_PRESETS.map((preset) => {
                const isSelected = width === preset.width && height === preset.height;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-amber-500/15 border-amber-500/50 text-amber-200 shadow-sm"
                        : "bg-zinc-950/60 border-zinc-850 hover:bg-zinc-900 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-bold truncate">{preset.label}</span>
                      <span className="text-[9px] font-mono px-1 rounded bg-white/5 text-zinc-400">
                        {preset.ratioLabel}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate mt-1">
                      {preset.platform}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                      {preset.width}×{preset.height}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opciones de Reencuadre Automático */}
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fitBackground}
                onChange={(e) => setFitBackground(e.target.checked)}
                className="rounded accent-amber-500 cursor-pointer"
              />
              <span className="text-zinc-300 text-[11px]">
                Adaptar capa de fondo automáticamente al nuevo tamaño
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fitImage}
                onChange={(e) => setFitImage(e.target.checked)}
                className="rounded accent-amber-500 cursor-pointer"
              />
              <span className="text-zinc-300 text-[11px]">
                Encuadrar la imagen principal para que cubra todo el lienzo sin bordes
              </span>
            </label>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-850">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs border-zinc-800 text-zinc-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold gap-1.5 shadow-lg shadow-amber-600/20"
            >
              <Check className="w-3.5 h-3.5" />
              Aplicar Dimensiones
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
