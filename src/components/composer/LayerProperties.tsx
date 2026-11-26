"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Award,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Layers,
  Lock,
  Maximize,
  Move,
  Paintbrush,
  Palette,
  Scissors,
  Sliders,
  Unlock,
  Upload,
  Wand2,
  Zap,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { removeBackground } from "./ai-background-removal";
import {
BackgroundLayer,
BrandLogoLayer,
CanvasDimensions,
CanvasLayer,
FLYER_FONTS,
ImageLayer,
ShapeLayer,
ShapeType,
TextLayer
} from "./types";

interface LayerPropertiesProps {
  layer: CanvasLayer | null;
  canvasDimensions?: CanvasDimensions;
  onUpdateLayer: (layerId: string, updates: Partial<CanvasLayer>) => void;
  onBringToFront?: (layerId: string) => void;
  onBringForward?: (layerId: string) => void;
  onSendBackward?: (layerId: string) => void;
  onSendToBack?: (layerId: string) => void;
  onOpenImageEditor?: (layerId: string, imageSrc: string) => void;
  onConvertToImageLayer?: (layerId: string) => void;
  brandColors?: { primary: string[]; secondary: string[] };
  availableBrands?: { id: string; name: string }[];
  onOpenComfyModal: (layerId?: string) => void;
  onFitCanvasToImage?: (imageUrl?: string) => void;
  onOpenCanvasSizeModal?: () => void;
}

export function LayerProperties({
  layer,
  canvasDimensions = { width: 1080, height: 1080, label: "1:1", sublabel: "Cuadrado", iconName: "Square" },
  onUpdateLayer,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onOpenImageEditor,
  onConvertToImageLayer,
  brandColors,
  availableBrands = [],
  onOpenComfyModal,
  onFitCanvasToImage,
  onOpenCanvasSizeModal,
}: LayerPropertiesProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const bgFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [propLockAspect, setPropLockAspect] = React.useState<boolean>(true);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>, isBg?: boolean) {
    const file = e.target.files?.[0];
    if (!file || !layer) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (isBg) {
        onUpdateLayer(layer.id, { fillType: "image", imageUrl: dataUrl });
        toast.success("Imagen de fondo cargada desde tu ordenador");
      } else if (layer.type === "brand-logo") {
        onUpdateLayer(layer.id, { customDataUrl: dataUrl, name: `Logo: ${file.name}` });
        toast.success("Logo cargado desde tu ordenador");
      } else {
        onUpdateLayer(layer.id, { imageUrl: dataUrl });
        toast.success("Imagen de capa cargada desde tu ordenador");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  if (!layer) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-zinc-500 bg-zinc-900/90 border border-zinc-800 rounded-xl">
        <Sliders className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-xs">Seleccioná una capa del canvas o de la lista para editar sus propiedades.</p>
      </div>
    );
  }

  // Paleta de acceso rápido con colores de la marca
  const quickPalette = [
    "#ffffff",
    "#000000",
    "#3b82f6",
    "#ec4899",
    "#8b5cf6",
    "#eab308",
    "#10b981",
    ...(brandColors?.primary || []),
    ...(brandColors?.secondary || []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="flex flex-col h-full bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
      {/* Inputs ocultos de selección de archivo */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelected(e, false)}
      />
      <input
        type="file"
        ref={bgFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelected(e, true)}
      />

      {/* Cabecera del Inspector */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Inspector: {layer.name}
          </span>
        </div>
        {onOpenCanvasSizeModal && (
          <button
            type="button"
            onClick={onOpenCanvasSizeModal}
            className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-750 text-zinc-400 hover:text-amber-300 hover:border-amber-500/50 transition-colors"
            title="Cambiar dimensiones del lienzo"
          >
            <Sliders className="w-2.5 h-2.5 text-amber-400" />
            <span>{canvasDimensions.width}×{canvasDimensions.height}</span>
          </button>
        )}
      </div>

      {/* Contenido scrolleable de propiedades */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs text-zinc-300">
        {/* PROPIEDADES DE TEXTO */}
        {layer.type === "text" && renderTextProperties(layer, onUpdateLayer, quickPalette)}

        {/* PROPIEDADES DE IMAGEN */}
        {layer.type === "image" &&
          renderImageProperties(
            layer,
            canvasDimensions,
            onUpdateLayer,
            onOpenComfyModal,
            onOpenImageEditor,
            // eslint-disable-next-line react-hooks/refs -- This callback is invoked by the upload button, never during render.
            () => fileInputRef.current?.click(),
            onFitCanvasToImage
          )}

        {/* PROPIEDADES DE FORMA / BADGE */}
        {layer.type === "shape" && renderShapeProperties(layer, onUpdateLayer, quickPalette)}

        {/* PROPIEDADES DE FONDO */}
        {layer.type === "background" &&
          renderBackgroundProperties(
            layer,
            canvasDimensions,
            onUpdateLayer,
            quickPalette,
            onOpenComfyModal,
            onOpenImageEditor,
            onConvertToImageLayer,
            // eslint-disable-next-line react-hooks/refs -- This callback is invoked by the upload button, never during render.
            () => bgFileInputRef.current?.click(),
            onFitCanvasToImage
          )}

        {/* PROPIEDADES DE LOGO DE MARCA */}
        {layer.type === "brand-logo" &&
          renderBrandLogoProperties(
            layer,
            canvasDimensions,
            onUpdateLayer,
            availableBrands,
            // eslint-disable-next-line react-hooks/refs -- Invoked by user click
            () => fileInputRef.current?.click()
          )}

        {/* ORGANIZAR Z-INDEX / MANDAR ATRÁS O ADELANTE */}
        {layer.type !== "background" && (
          <div className="pt-3 border-t border-zinc-800/80 space-y-2">
            <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Organizar Capa (Z-Index)
            </Label>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => onBringToFront?.(layer.id)}
                className="h-8 bg-zinc-950 border-zinc-800 hover:bg-cyan-950/40 hover:border-cyan-500/50 text-zinc-200 hover:text-cyan-300 gap-1 text-[11px]"
                title="Traer al frente de todo"
              >
                <ChevronsUp className="w-3.5 h-3.5 text-cyan-400" />
                Al Frente
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => onBringForward?.(layer.id)}
                className="h-8 bg-zinc-950 border-zinc-800 hover:bg-cyan-950/40 hover:border-cyan-500/50 text-zinc-200 hover:text-cyan-300 gap-1 text-[11px]"
                title="Subir un nivel"
              >
                <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                Adelante
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => onSendBackward?.(layer.id)}
                className="h-8 bg-zinc-950 border-zinc-800 hover:bg-cyan-950/40 hover:border-cyan-500/50 text-zinc-200 hover:text-cyan-300 gap-1 text-[11px]"
                title="Bajar un nivel"
              >
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                Atrás
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => onSendToBack?.(layer.id)}
                className="h-8 bg-zinc-950 border-zinc-800 hover:bg-cyan-950/40 hover:border-cyan-500/50 text-zinc-200 hover:text-cyan-300 gap-1 text-[11px]"
                title="Enviar al fondo (sobre el fondo)"
              >
                <ChevronsDown className="w-3.5 h-3.5 text-cyan-400" />
                Al Fondo
              </Button>
            </div>
          </div>
        )}

        {/* POSICIÓN Y TAMAÑO GLOBAL */}
        <div className="pt-3 border-t border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Posición y Dimensiones
            </Label>
            <button
              type="button"
              onClick={() => setPropLockAspect(!propLockAspect)}
              className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${
                propLockAspect
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold"
                  : "bg-zinc-900 border-zinc-750 text-zinc-400 hover:text-zinc-200"
              }`}
              title={
                propLockAspect
                  ? "Proporción bloqueada (ancho y alto se escalan juntos). Clic para libre."
                  : "Proporción libre (puedes estirar ancho y alto de forma independiente). Clic para bloquear."
              }
            >
              {propLockAspect ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Unlock className="w-2.5 h-2.5 text-zinc-400" />}
              <span>{propLockAspect ? "Proporcional" : "Libre"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-zinc-500">X (px):</span>
              <Input
                type="number"
                value={layer.x}
                onChange={(e) => onUpdateLayer(layer.id, { x: parseInt(e.target.value) || 0 })}
                className="h-7 text-xs bg-zinc-950 border-zinc-800"
              />
            </div>
            <div>
              <span className="text-zinc-500">Y (px):</span>
              <Input
                type="number"
                value={layer.y}
                onChange={(e) => onUpdateLayer(layer.id, { y: parseInt(e.target.value) || 0 })}
                className="h-7 text-xs bg-zinc-950 border-zinc-800"
              />
            </div>
            <div>
              <span className="text-zinc-500">Ancho (px):</span>
              <Input
                type="number"
                value={layer.width}
                onChange={(e) => {
                  const newW = parseInt(e.target.value) || 10;
                  if (propLockAspect && layer.width > 0 && layer.height > 0) {
                    const ratio = layer.width / layer.height;
                    const newH = Math.max(10, Math.round(newW / ratio));
                    onUpdateLayer(layer.id, { width: newW, height: newH });
                  } else {
                    onUpdateLayer(layer.id, { width: newW });
                  }
                }}
                className="h-7 text-xs bg-zinc-950 border-zinc-800"
              />
            </div>
            <div>
              <span className="text-zinc-500">Alto (px):</span>
              <Input
                type="number"
                value={layer.height}
                onChange={(e) => {
                  const newH = parseInt(e.target.value) || 10;
                  if (propLockAspect && layer.width > 0 && layer.height > 0) {
                    const ratio = layer.width / layer.height;
                    const newW = Math.max(10, Math.round(newH * ratio));
                    onUpdateLayer(layer.id, { width: newW, height: newH });
                  } else {
                    onUpdateLayer(layer.id, { height: newH });
                  }
                }}
                className="h-7 text-xs bg-zinc-950 border-zinc-800"
              />
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Rotación:</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="-180"
                max="180"
                value={layer.rotation || 0}
                onChange={(e) => onUpdateLayer(layer.id, { rotation: parseInt(e.target.value) })}
                className="w-24 h-1 accent-amber-400 cursor-pointer"
              />
              <span className="font-mono text-zinc-400 w-10 text-right">{layer.rotation || 0}°</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderTextProperties(
  layer: TextLayer,
  onUpdateLayer: (layerId: string, updates: Partial<TextLayer>) => void,
  quickPalette: string[]
) {
  return (
    <div className="space-y-3.5">
      {/* Contenido del texto */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-zinc-400">Texto / Titular</Label>
        <Textarea
          value={layer.text}
          onChange={(e) => onUpdateLayer(layer.id, { text: e.target.value })}
          rows={2}
          className="text-xs bg-zinc-950 border-zinc-800 focus:border-amber-400"
          placeholder="Escribí aquí tu titular o frase..."
        />
      </div>

      {/* Fuente Tipográfica Google Fonts */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-zinc-400">Fuente Tipográfica</Label>
        <select
          value={layer.fontFamily}
          onChange={(e) => onUpdateLayer(layer.id, { fontFamily: e.target.value })}
          className="w-full h-8 text-xs bg-zinc-950 border border-zinc-800 rounded-md px-2 text-zinc-200 focus:outline-none focus:border-amber-400"
        >
          {FLYER_FONTS.map((font) => (
            <option key={font.family} value={font.family}>
              {font.displayName} [{font.category}]
            </option>
          ))}
        </select>
      </div>

      {/* Tamaño, Peso y Alineación */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-zinc-400">Tamaño (px)</Label>
          <Input
            type="number"
            min={12}
            max={300}
            value={layer.fontSize}
            onChange={(e) => onUpdateLayer(layer.id, { fontSize: parseInt(e.target.value) || 24 })}
            className="h-7 text-xs bg-zinc-950 border-zinc-800"
          />
        </div>

        <div>
          <Label className="text-[10px] text-zinc-400">Peso (Weight)</Label>
          <select
            value={layer.fontWeight}
            onChange={(e) => onUpdateLayer(layer.id, { fontWeight: parseInt(e.target.value) || e.target.value })}
            className="w-full h-7 text-xs bg-zinc-950 border border-zinc-800 rounded-md px-2 text-zinc-200"
          >
            <option value={400}>Regular (400)</option>
            <option value={600}>Semibold (600)</option>
            <option value={700}>Bold (700)</option>
            <option value={900}>Black / Heavy (900)</option>
          </select>
        </div>
      </div>

      {/* Alineación y Transformación */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center bg-zinc-950 p-0.5 rounded-md border border-zinc-800">
          <button
            onClick={() => onUpdateLayer(layer.id, { textAlign: "left" })}
            className={`p-1.5 rounded ${layer.textAlign === "left" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onUpdateLayer(layer.id, { textAlign: "center" })}
            className={`p-1.5 rounded ${layer.textAlign === "center" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onUpdateLayer(layer.id, { textAlign: "right" })}
            className={`p-1.5 rounded ${layer.textAlign === "right" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onUpdateLayer(layer.id, {
                textTransform: layer.textTransform === "uppercase" ? "none" : "uppercase",
              })
            }
            className={`h-7 px-2 text-[10px] ${layer.textTransform === "uppercase" ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "border-zinc-800 text-zinc-400"}`}
          >
            MAYÚS
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onUpdateLayer(layer.id, {
                fontStyle: layer.fontStyle === "italic" ? "normal" : "italic",
              })
            }
            className={`h-7 px-2 text-[10px] italic ${layer.fontStyle === "italic" ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "border-zinc-800 text-zinc-400"}`}
          >
            Italic
          </Button>
        </div>
      </div>

      {/* Espaciado de letras & Interlineado */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-400">Espaciado de letras:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min="-2"
              max="20"
              step="1"
              value={layer.letterSpacing || 0}
              onChange={(e) => onUpdateLayer(layer.id, { letterSpacing: parseInt(e.target.value) })}
              className="w-20 h-1 accent-amber-400 cursor-pointer"
            />
            <span className="font-mono text-zinc-400 w-6 text-right">{layer.letterSpacing || 0}px</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-400">Interlineado (Line-height):</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min="0.8"
              max="2.0"
              step="0.05"
              value={layer.lineHeight || 1.15}
              onChange={(e) => onUpdateLayer(layer.id, { lineHeight: parseFloat(e.target.value) })}
              className="w-20 h-1 accent-amber-400 cursor-pointer"
            />
            <span className="font-mono text-zinc-400 w-6 text-right">{layer.lineHeight || 1.15}x</span>
          </div>
        </div>
      </div>

      {/* Color de Relleno & Paleta */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-zinc-400">Color de Texto</Label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={layer.color || "#ffffff"}
              onChange={(e) => onUpdateLayer(layer.id, { color: e.target.value })}
              className="w-5 h-5 rounded border border-zinc-700 bg-transparent cursor-pointer"
            />
            <span className="font-mono text-[10px] text-zinc-400">{layer.color}</span>
          </div>
        </div>

        {/* Acceso rápido paleta */}
        <div className="flex items-center gap-1 flex-wrap">
          {quickPalette.map((c, i) => (
            <button
              key={i}
              onClick={() => onUpdateLayer(layer.id, { color: c })}
              className="w-4 h-4 rounded-full border border-zinc-700 hover:scale-125 transition-transform"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Gradiente en Texto */}
      <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-amber-300">Degradado en Letras</span>
          <input
            type="checkbox"
            checked={!!layer.gradient?.enabled}
            onChange={(e) =>
              onUpdateLayer(layer.id, {
                gradient: {
                  enabled: e.target.checked,
                  startColor: layer.gradient?.startColor || layer.color || "#ffffff",
                  endColor: layer.gradient?.endColor || "#eab308",
                  angle: layer.gradient?.angle || 90,
                },
              })
            }
            className="rounded accent-amber-400"
          />
        </div>

        {layer.gradient?.enabled && (
          <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
            <div>
              <span className="text-zinc-500">Color Inicial:</span>
              <input
                type="color"
                value={layer.gradient.startColor}
                onChange={(e) =>
                  onUpdateLayer(layer.id, {
                    gradient: { ...layer.gradient!, startColor: e.target.value },
                  })
                }
                className="w-full h-6 rounded bg-transparent cursor-pointer"
              />
            </div>
            <div>
              <span className="text-zinc-500">Color Final:</span>
              <input
                type="color"
                value={layer.gradient.endColor}
                onChange={(e) =>
                  onUpdateLayer(layer.id, {
                    gradient: { ...layer.gradient!, endColor: e.target.value },
                  })
                }
                className="w-full h-6 rounded bg-transparent cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Contorno / Stroke */}
      <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-300">Contorno / Trazo Exterior</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={layer.strokeColor || "#000000"}
              onChange={(e) => onUpdateLayer(layer.id, { strokeColor: e.target.value })}
              className="w-4 h-4 rounded bg-transparent cursor-pointer"
            />
            <input
              type="number"
              min={0}
              max={20}
              value={layer.strokeWidth || 0}
              onChange={(e) => onUpdateLayer(layer.id, { strokeWidth: parseInt(e.target.value) || 0 })}
              className="w-12 h-6 text-xs bg-zinc-900 border border-zinc-700 rounded px-1 text-center"
            />
          </div>
        </div>
      </div>

      {/* Sombra / Glow / Resplandor */}
      <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-300">Sombra & Glow Neón</span>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-cyan-400 flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={!!layer.glow}
                onChange={(e) =>
                  onUpdateLayer(layer.id, {
                    glow: e.target.checked,
                    glowColor: layer.glowColor || "#38bdf8",
                    shadowBlur: e.target.checked ? 25 : 8,
                  })
                }
                className="rounded accent-cyan-400"
              />
              Glow
            </label>
            <input
              type="color"
              value={layer.glow ? layer.glowColor || "#38bdf8" : layer.shadowColor || "#000000"}
              onChange={(e) =>
                onUpdateLayer(layer.id, {
                  glowColor: e.target.value,
                  shadowColor: e.target.value,
                })
              }
              className="w-4 h-4 rounded bg-transparent cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">Intensidad Difuminado:</span>
          <input
            type="range"
            min={0}
            max={60}
            value={layer.shadowBlur || 0}
            onChange={(e) => onUpdateLayer(layer.id, { shadowBlur: parseInt(e.target.value) })}
            className="w-24 h-1 accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Caja de Fondo (Pill / Contrast Box) */}
      <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-purple-300">Caja de Contraste / Píldora</span>
          <input
            type="checkbox"
            checked={!!layer.boxBackground?.enabled}
            onChange={(e) =>
              onUpdateLayer(layer.id, {
                boxBackground: {
                  enabled: e.target.checked,
                  color: layer.boxBackground?.color || "#090d16",
                  opacity: layer.boxBackground?.opacity || 0.85,
                  paddingX: layer.boxBackground?.paddingX || 24,
                  paddingY: layer.boxBackground?.paddingY || 12,
                  borderRadius: layer.boxBackground?.borderRadius || 12,
                },
              })
            }
            className="rounded accent-purple-400"
          />
        </div>

        {layer.boxBackground?.enabled && (
          <div className="space-y-2 pt-1 text-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Color Fondo:</span>
              <input
                type="color"
                value={layer.boxBackground.color}
                onChange={(e) =>
                  onUpdateLayer(layer.id, {
                    boxBackground: { ...layer.boxBackground!, color: e.target.value },
                  })
                }
                className="w-5 h-5 rounded bg-transparent cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Curvatura Esquinas:</span>
              <input
                type="range"
                min={0}
                max={50}
                value={layer.boxBackground.borderRadius}
                onChange={(e) =>
                  onUpdateLayer(layer.id, {
                    boxBackground: { ...layer.boxBackground!, borderRadius: parseInt(e.target.value) },
                  })
                }
                className="w-24 h-1 accent-purple-400 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderImageProperties(
  layer: ImageLayer,
  canvasDimensions: CanvasDimensions,
  onUpdateLayer: (layerId: string, updates: Partial<ImageLayer>) => void,
  onOpenComfyModal: (layerId?: string) => void,
  onOpenImageEditor?: (layerId: string, imageSrc: string) => void,
  onUploadClick?: () => void,
  onFitCanvasToImage?: (imageUrl?: string) => void
) {
  const currentRatio = layer.width / (layer.height || 1);

  return (
    <div className="space-y-3">
      {/* ORIGEN DE IMAGEN */}
      <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
            Origen de Imagen
          </Label>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={onUploadClick}
              className="h-6 px-2 text-[10px] bg-amber-950/50 border-amber-700/60 hover:bg-amber-900/60 text-amber-300 gap-1 font-semibold"
              title="Subir archivo de imagen desde tu computadora"
            >
              <Upload className="w-3 h-3 text-amber-400" />
              Subir PC
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenComfyModal(layer.id)}
              className="h-6 px-2 text-[10px] bg-cyan-950/60 border-cyan-700/60 text-cyan-300 hover:border-cyan-400 gap-1"
            >
              <Wand2 className="w-3 h-3 text-cyan-400" />
              + IA
            </Button>
          </div>
        </div>

        {layer.imageUrl ? (
          <div className="space-y-2">
            <div
              className="w-full h-28 rounded border border-zinc-800 flex items-center justify-center p-1 overflow-hidden"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
                backgroundSize: "12px 12px",
                backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
                backgroundColor: "#09090b",
              }}
            >
              <img
                src={layer.imageUrl}
                alt="Preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {/* Botones de Edición / Pintar / Borrar y Recorte de Fondo */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => onOpenImageEditor?.(layer.id, layer.imageUrl)}
                className="h-8 text-[11px] bg-cyan-950/50 border-cyan-700/60 hover:bg-cyan-900/60 text-cyan-300 gap-1"
                title="Abrir estudio para pintar, borrar, usar varita mágica o recortar"
              >
                <Paintbrush className="w-3.5 h-3.5 text-cyan-400" />
                Pintar / Borrar
              </Button>

              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={async () => {
                  const loadingId = toast.loading("Quitando el fondo con IA…");
                  try {
                    const cut = await removeBackground(layer.imageUrl);
                    onUpdateLayer(layer.id, { imageUrl: cut.image });
                    toast.success(
                      cut.method === "ia"
                        ? "Fondo eliminado con IA"
                        : "Fondo eliminado por color (encendé ComfyUI para un mejor recorte)",
                      { id: loadingId },
                    );
                  } catch (err) {
                    toast.error("Error al remover fondo", {
                      id: loadingId,
                      description: err instanceof Error ? err.message : undefined,
                    });
                  }
                }}
                className="h-8 text-[11px] bg-emerald-950/40 border-emerald-800/60 hover:bg-emerald-900/60 text-emerald-300 gap-1"
                title="Quitar el fondo con IA (Qwen local)"
              >
                <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                Quitar Fondo
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-zinc-500 border border-dashed border-zinc-800 rounded">
            Sin imagen cargada
          </div>
        )}

        <div>
          <span className="text-[10px] text-zinc-500">URL / Base64:</span>
          <Input
            value={layer.imageUrl}
            onChange={(e) => onUpdateLayer(layer.id, { imageUrl: e.target.value })}
            className="h-7 text-[11px] bg-zinc-900 border-zinc-800"
            placeholder="Pegá URL o generá con IA..."
          />
        </div>
      </div>

      {/* ENCUADRE Y AJUSTE RÁPIDO AL LIENZO */}
      <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5">
        <Label className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider flex items-center justify-between">
          <span>Encuadre y Ajuste</span>
          <span className="text-[10px] font-mono text-zinc-400">
            {canvasDimensions.width}×{canvasDimensions.height}px
          </span>
        </Label>

        {/* Botones de acción rápida de encuadre */}
        <div className="space-y-1.5">
          {onFitCanvasToImage && layer.imageUrl && (
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => onFitCanvasToImage(layer.imageUrl)}
              className="w-full h-8 bg-amber-950/40 border-amber-500/50 hover:bg-amber-900/50 text-amber-300 text-[11px] gap-1.5 font-semibold shadow-sm"
              title="Redimensiona el lienzo entero para que coincida exactamente con las medidas de esta imagen (elimina cualquier borde o margen)"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              📐 Ajustar Lienzo a esta Imagen (Cero Bordes)
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              onUpdateLayer(layer.id, {
                x: 0,
                y: 0,
                width: canvasDimensions.width,
                height: canvasDimensions.height,
                objectFit: "cover",
              });
              toast.success("Imagen ajustada a todo el lienzo");
            }}
            className="h-8 bg-zinc-900 border-amber-500/40 hover:bg-amber-500/20 text-amber-300 text-[10px] gap-1 font-medium"
            title="Llenar y cubrir todo el lienzo del flyer"
          >
            <Maximize className="w-3 h-3 text-amber-400" />
            Llenar Lienzo
          </Button>

          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              onUpdateLayer(layer.id, {
                x: Math.round((canvasDimensions.width - layer.width) / 2),
                y: Math.round((canvasDimensions.height - layer.height) / 2),
              });
              toast.success("Imagen centrada");
            }}
            className="h-8 bg-zinc-900 border-cyan-500/40 hover:bg-cyan-500/20 text-cyan-300 text-[10px] gap-1 font-medium"
            title="Centrar en el lienzo horizontal y verticalmente"
          >
            <Move className="w-3 h-3 text-cyan-400" />
            Centrar
          </Button>

          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              const newW = canvasDimensions.width;
              const newH = Math.round(newW / (currentRatio || 1));
              const newY = Math.round((canvasDimensions.height - newH) / 2);
              onUpdateLayer(layer.id, { x: 0, y: newY, width: newW, height: newH });
              toast.success("Ajustado al ancho del lienzo");
            }}
            className="h-8 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-[10px] gap-1"
            title="Ajustar al 100% de ancho manteniendo proporción"
          >
            ↔️ Ancho 100%
          </Button>

          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              const newH = canvasDimensions.height;
              const newW = Math.round(newH * (currentRatio || 1));
              const newX = Math.round((canvasDimensions.width - newW) / 2);
              onUpdateLayer(layer.id, { x: newX, y: 0, width: newW, height: newH });
              toast.success("Ajustado al alto del lienzo");
            }}
            className="h-8 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-[10px] gap-1"
            title="Ajustar al 100% de alto manteniendo proporción"
          >
            ↕️ Alto 100%
          </Button>
        </div>

        {/* Modo de Ajuste / Object-Fit */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span>Comportamiento de Imagen:</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onUpdateLayer(layer.id, { objectFit: "cover" })}
              className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-colors ${
                layer.objectFit === "cover" || !layer.objectFit
                  ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
              title="Encuadra la foto rellenando la caja y recortando excesos sin deformar"
            >
              Cubrir (Cover)
            </button>
            <button
              type="button"
              onClick={() => onUpdateLayer(layer.id, { objectFit: "contain" })}
              className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-colors ${
                layer.objectFit === "contain"
                  ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
              title="Muestra la foto entera sin recortar nada"
            >
              Contener
            </button>
            <button
              type="button"
              onClick={() => onUpdateLayer(layer.id, { objectFit: "fill" })}
              className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-colors ${
                layer.objectFit === "fill"
                  ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
              title="Estira la imagen exactamente a las medidas de ancho y alto"
            >
              Estirar (Fill)
            </button>
          </div>
        </div>

        {/* Borde Redondeado */}
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/80">
          <span className="text-zinc-400">Borde Redondeado:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0}
              max={150}
              value={layer.borderRadius || 0}
              onChange={(e) => onUpdateLayer(layer.id, { borderRadius: parseInt(e.target.value) || 0 })}
              className="w-20 h-1 accent-amber-400 cursor-pointer"
            />
            <span className="font-mono text-zinc-400 w-8 text-right">{layer.borderRadius || 0}px</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderShapeProperties(
  layer: ShapeLayer,
  onUpdateLayer: (layerId: string, updates: Partial<ShapeLayer>) => void,
  quickPalette: string[]
) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[11px] text-zinc-400">Tipo de Forma</Label>
        <select
          value={layer.shapeType}
          onChange={(e) => onUpdateLayer(layer.id, { shapeType: e.target.value as ShapeType })}
          className="w-full h-8 bg-zinc-950 border border-zinc-800 rounded px-2 text-zinc-200"
        >
          <option value="rectangle">Rectángulo</option>
          <option value="circle">Círculo / Óvalo</option>
          <option value="pill">Píldora / Badge</option>
          <option value="gradient-overlay">Degradado Overlay de Contraste</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-zinc-400">Color de Relleno</Label>
          <input
            type="color"
            value={layer.fillColor || "#3b82f6"}
            onChange={(e) => onUpdateLayer(layer.id, { fillColor: e.target.value })}
            className="w-5 h-5 rounded bg-transparent cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {quickPalette.map((c, i) => (
            <button
              key={i}
              onClick={() => onUpdateLayer(layer.id, { fillColor: c })}
              className="w-4 h-4 rounded-full border border-zinc-700 hover:scale-125 transition-transform"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function renderBackgroundProperties(
  layer: BackgroundLayer,
  canvasDimensions: CanvasDimensions,
  onUpdateLayer: (layerId: string, updates: Partial<BackgroundLayer>) => void,
  quickPalette: string[],
  onOpenComfyModal: (layerId?: string) => void,
  onOpenImageEditor?: (layerId: string, imageSrc: string) => void,
  onConvertToImageLayer?: (layerId: string) => void,
  onUploadClick?: () => void,
  onFitCanvasToImage?: (imageUrl?: string) => void
) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[11px] text-zinc-400">Tipo de Fondo</Label>
        <div className="grid grid-cols-3 gap-1 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateLayer(layer.id, { fillType: "color" })}
            className={`h-7 text-[10px] ${layer.fillType === "color" ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "border-zinc-800 text-zinc-400"}`}
          >
            Color Plano
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateLayer(layer.id, { fillType: "gradient" })}
            className={`h-7 text-[10px] ${layer.fillType === "gradient" ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "border-zinc-800 text-zinc-400"}`}
          >
            Gradiente
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateLayer(layer.id, { fillType: "image" })}
            className={`h-7 text-[10px] ${layer.fillType === "image" ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "border-zinc-800 text-zinc-400"}`}
          >
            Foto / Imagen
          </Button>
        </div>
      </div>

      {layer.fillType === "color" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Color de Fondo:</span>
            <input
              type="color"
              value={layer.color || "#090d16"}
              onChange={(e) => onUpdateLayer(layer.id, { color: e.target.value })}
              className="w-6 h-6 rounded bg-transparent cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {quickPalette.map((c, i) => (
              <button
                key={i}
                onClick={() => onUpdateLayer(layer.id, { color: c })}
                className="w-4 h-4 rounded-full border border-zinc-700 hover:scale-125 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {layer.fillType === "gradient" && (
        <div className="space-y-2 p-2 rounded bg-zinc-950 border border-zinc-800">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-zinc-500">Color Inicio:</span>
              <input
                type="color"
                value={layer.gradientStart || "#0f172a"}
                onChange={(e) => onUpdateLayer(layer.id, { gradientStart: e.target.value })}
                className="w-full h-6 rounded bg-transparent cursor-pointer"
              />
            </div>
            <div>
              <span className="text-zinc-500">Color Fin:</span>
              <input
                type="color"
                value={layer.gradientEnd || "#020617"}
                onChange={(e) => onUpdateLayer(layer.id, { gradientEnd: e.target.value })}
                className="w-full h-6 rounded bg-transparent cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {layer.fillType === "image" && (
        <div className="space-y-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={onUploadClick}
              className="h-8 bg-amber-950/50 border-amber-700/60 hover:bg-amber-900/60 text-amber-300 text-[11px] gap-1 font-semibold"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              Subir Foto PC
            </Button>
            <Button
              size="sm"
              onClick={() => onOpenComfyModal(layer.id)}
              className="h-8 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[11px] gap-1"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Generar con IA
            </Button>
          </div>

          {layer.imageUrl && (
            <div className="space-y-2 mt-2">
              <img
                src={layer.imageUrl}
                alt="Fondo"
                className="w-full h-28 object-cover rounded border border-zinc-800"
              />

              {onFitCanvasToImage && (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => onFitCanvasToImage(layer.imageUrl)}
                  className="w-full h-8 text-[11px] bg-amber-950/40 border-amber-500/50 hover:bg-amber-900/50 text-amber-300 gap-1.5 font-semibold"
                  title="Ajustar dimensiones del lienzo para que coincidan exactamente con esta foto (sin recortar nada)"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  📐 Ajustar Lienzo al Tamaño de la Foto
                </Button>
              )}

              {/* Botón destacado para convertir fondo a capa libre */}
              <Button
                size="sm"
                type="button"
                onClick={() => onConvertToImageLayer?.(layer.id)}
                className="w-full h-8 text-[11px] bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white gap-1.5 font-semibold shadow-md"
                title="Convierte esta foto de fondo en una capa libre para moverla, achicarla, agrandarla o rotarla en cualquier lugar"
              >
                <Move className="w-3.5 h-3.5" />
                Convertir a Capa Libre (Mover & Redimensionar)
              </Button>

              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => onOpenImageEditor?.(layer.id, layer.imageUrl!)}
                className="w-full h-7 text-[11px] bg-cyan-950/40 border-cyan-800/60 hover:bg-cyan-900/60 text-cyan-300 gap-1.5"
              >
                <Paintbrush className="w-3.5 h-3.5" />
                Pintar / Borrar / Retocar Fondo
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderBrandLogoProperties(
  layer: BrandLogoLayer,
  canvasDimensions: CanvasDimensions,
  onUpdateLayer: (layerId: string, updates: Partial<BrandLogoLayer>) => void,
  availableBrands: { id: string; name: string }[],
  onUploadLogoClick?: () => void
) {
  const currentRatio = layer.width / (layer.height || 1);

  return (
    <div className="space-y-3">
      {/* ORIGEN Y ARCHIVO DEL LOGO */}
      <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-purple-400" />
            Logo de Marca
          </Label>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={onUploadLogoClick}
            className="h-6 px-2 text-[10px] bg-purple-950/50 border-purple-700/60 hover:bg-purple-900/60 text-purple-300 gap-1 font-semibold"
            title="Subir archivo de logo propio (PNG transparente, SVG, etc.)"
          >
            <Upload className="w-3 h-3 text-purple-400" />
            Subir Logo
          </Button>
        </div>

        {/* Preview del Logo actual */}
        {layer.customDataUrl ? (
          <div
            className="w-full h-24 rounded border border-zinc-800 flex items-center justify-center p-2 overflow-hidden"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
              backgroundSize: "12px 12px",
              backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
              backgroundColor: "#09090b",
            }}
          >
            <img
              src={layer.customDataUrl}
              alt="Logo Preview"
              className="max-h-full max-w-full object-contain"
              style={{
                filter:
                  layer.variant === "white"
                    ? "brightness(0) invert(1)"
                    : layer.variant === "black"
                    ? "brightness(0)"
                    : "none",
              }}
            />
          </div>
        ) : (
          <div className="p-3 rounded border border-purple-800/40 bg-purple-950/20 text-center space-y-1">
            <p className="text-[11px] text-purple-300 font-medium">Usando logo del BrandKit</p>
            <p className="text-[10px] text-zinc-400">
              Podés subir un PNG o SVG propio con el botón &quot;Subir Logo&quot;.
            </p>
          </div>
        )}

        {/* Marca asociada */}
        {availableBrands.length > 0 && (
          <div>
            <Label className="text-[10px] text-zinc-400">Marca Asociada:</Label>
            <select
              value={layer.brandId}
              onChange={(e) => onUpdateLayer(layer.id, { brandId: e.target.value })}
              className="w-full h-7 text-xs bg-zinc-900 border border-zinc-800 rounded px-2 text-zinc-200 mt-1"
            >
              {availableBrands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Variante cromática del logo */}
        <div className="space-y-1 pt-1 border-t border-zinc-800/80">
          <Label className="text-[10px] text-zinc-400">Variante Cromática:</Label>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onUpdateLayer(layer.id, { variant: "original" })}
              className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-colors ${
                !layer.variant || layer.variant === "original"
                  ? "bg-purple-500/20 border-purple-500/60 text-purple-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Original
            </button>
            <button
              type="button"
              onClick={() => onUpdateLayer(layer.id, { variant: "white" })}
              className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-colors ${
                layer.variant === "white"
                  ? "bg-purple-500/20 border-purple-500/60 text-purple-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Blanco
            </button>
            <button
              type="button"
              onClick={() => onUpdateLayer(layer.id, { variant: "black" })}
              className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-colors ${
                layer.variant === "black"
                  ? "bg-purple-500/20 border-purple-500/60 text-purple-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Negro
            </button>
          </div>
        </div>

        {/* Posicionamiento Rápido en Esquinas o Centro */}
        <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
          <Label className="text-[10px] text-zinc-400">Ubicar en el Lienzo:</Label>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onUpdateLayer(layer.id, { x: 40, y: 40 })}
              className="py-1 px-1 bg-zinc-900 hover:bg-purple-950/50 border border-zinc-800 hover:border-purple-500/50 rounded text-[10px] text-zinc-300 hover:text-purple-300"
              title="Arriba a la izquierda"
            >
              ↖ Arriba Izq
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLayer(layer.id, {
                  x: Math.round((canvasDimensions.width - layer.width) / 2),
                  y: Math.round((canvasDimensions.height - layer.height) / 2),
                })
              }
              className="py-1 px-1 bg-zinc-900 hover:bg-purple-950/50 border border-zinc-800 hover:border-purple-500/50 rounded text-[10px] text-zinc-300 hover:text-purple-300"
              title="Centrar en el lienzo"
            >
              ✦ Centrar
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLayer(layer.id, { x: Math.round(canvasDimensions.width - layer.width - 40), y: 40 })
              }
              className="py-1 px-1 bg-zinc-900 hover:bg-purple-950/50 border border-zinc-800 hover:border-purple-500/50 rounded text-[10px] text-zinc-300 hover:text-purple-300"
              title="Arriba a la derecha"
            >
              ↗ Arriba Der
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLayer(layer.id, { x: 40, y: Math.round(canvasDimensions.height - layer.height - 40) })
              }
              className="py-1 px-1 bg-zinc-900 hover:bg-purple-950/50 border border-zinc-800 hover:border-purple-500/50 rounded text-[10px] text-zinc-300 hover:text-purple-300"
              title="Abajo a la izquierda"
            >
              ↙ Abajo Izq
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLayer(layer.id, {
                  x: Math.round((canvasDimensions.width - layer.width) / 2),
                  y: Math.round(canvasDimensions.height - layer.height - 40),
                })
              }
              className="py-1 px-1 bg-zinc-900 hover:bg-purple-950/50 border border-zinc-800 hover:border-purple-500/50 rounded text-[10px] text-zinc-300 hover:text-purple-300"
              title="Abajo al centro"
            >
              ↓ Pie Centro
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLayer(layer.id, {
                  x: Math.round(canvasDimensions.width - layer.width - 40),
                  y: Math.round(canvasDimensions.height - layer.height - 40),
                })
              }
              className="py-1 px-1 bg-zinc-900 hover:bg-purple-950/50 border border-zinc-800 hover:border-purple-500/50 rounded text-[10px] text-zinc-300 hover:text-purple-300"
              title="Abajo a la derecha"
            >
              ↘ Abajo Der
            </button>
          </div>
        </div>

        {/* Tamaños Rápidos */}
        <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
          <Label className="text-[10px] text-zinc-400">Tamaño del Logo:</Label>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => {
                const w = 120;
                const h = Math.round(w / (currentRatio || 1.6));
                onUpdateLayer(layer.id, { width: w, height: h });
              }}
              className="py-1 px-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[10px] text-zinc-300"
            >
              Chico (120px)
            </button>
            <button
              type="button"
              onClick={() => {
                const w = 180;
                const h = Math.round(w / (currentRatio || 1.6));
                onUpdateLayer(layer.id, { width: w, height: h });
              }}
              className="py-1 px-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[10px] text-zinc-300"
            >
              Medio (180px)
            </button>
            <button
              type="button"
              onClick={() => {
                const w = 260;
                const h = Math.round(w / (currentRatio || 1.6));
                onUpdateLayer(layer.id, { width: w, height: h });
              }}
              className="py-1 px-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[10px] text-zinc-300"
            >
              Grande (260px)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
