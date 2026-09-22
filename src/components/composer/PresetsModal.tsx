"use client";

import { Dialog,DialogContent,DialogDescription,DialogTitle } from "@/components/ui/dialog";
import { Plus,Sparkles,Type } from "lucide-react";
import { useState } from "react";
import { GRAPHIC_PRESETS,TEXT_PRESETS } from "./layer-presets";
import { GraphicPreset,TextPreset } from "./types";

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTextPreset: (preset: TextPreset) => void;
  onSelectGraphicPreset: (preset: GraphicPreset) => void;
  initialTab?: "text" | "graphics";
}

export function PresetsModal({
  isOpen,
  onClose,
  onSelectTextPreset,
  onSelectGraphicPreset,
  initialTab = "text",
}: PresetsModalProps) {
  const [activeTab, setActiveTab] = useState<"text" | "graphics">(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const textCategories = ["all", "Titulares", "Subtítulos & Bajadas", "Badges & Tags", "Precios & CTA", "Editorial"];
  const graphicCategories = ["all", "Badges Promocionales", "Efectos & Overlays", "Formas Básicas"];

  const filteredTextPresets =
    selectedCategory === "all"
      ? TEXT_PRESETS
      : TEXT_PRESETS.filter((p) => p.category === selectedCategory);

  const filteredGraphicPresets =
    selectedCategory === "all"
      ? GRAPHIC_PRESETS
      : GRAPHIC_PRESETS.filter((p) => p.category === selectedCategory);

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl">
        {/* Cabecera del Modal */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 shadow-md">
              {activeTab === "text" ? (
                <Type className="w-5 h-5 text-white" />
              ) : (
                <Sparkles className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                Biblioteca de Letras, Estilos & Elementos
              </DialogTitle>
              <DialogDescription className="text-[11px] text-zinc-400">
                Selecciona un estilo prediseñado para insertarlo directamente como nueva capa en tu flyer.
              </DialogDescription>
            </div>
          </div>

          {/* Selector de Pestaña */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 gap-1 self-start sm:self-auto">
            <button
              onClick={() => {
                setActiveTab("text");
                setSelectedCategory("all");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === "text"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              Tipografías & Letras
            </button>
            <button
              onClick={() => {
                setActiveTab("graphics");
                setSelectedCategory("all");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === "graphics"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Badges & Formas
            </button>
          </div>
        </div>

        {/* Filtro por Categorías */}
        <div className="px-4 py-2 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto text-xs">
          {(activeTab === "text" ? textCategories : graphicCategories).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-zinc-100 text-zinc-900 font-semibold shadow"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              {cat === "all" ? "Todos los estilos" : cat}
            </button>
          ))}
        </div>

        {/* Grid de Presets */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {activeTab === "text" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTextPresets.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => {
                    onSelectTextPreset(preset);
                    onClose();
                  }}
                  className="group relative flex flex-col p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/70 hover:border-amber-500/60 transition-all cursor-pointer shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-400">
                      {preset.category}
                    </span>
                    <span className="text-[11px] text-zinc-400 group-hover:text-amber-300 font-medium flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Insertar
                    </span>
                  </div>

                  {/* Vista Previa del Texto */}
                  <div className="my-3 p-4 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-center text-center min-h-[70px] overflow-hidden group-hover:border-zinc-700 transition-colors">
                    <span className="text-base font-bold text-white tracking-wide">
                      {preset.preview}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-zinc-100 group-hover:text-amber-200 transition-colors">
                      {preset.name}
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                      {preset.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredGraphicPresets.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => {
                    onSelectGraphicPreset(preset);
                    onClose();
                  }}
                  className="group relative flex flex-col p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/70 hover:border-cyan-500/60 transition-all cursor-pointer shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-cyan-400">
                      {preset.category}
                    </span>
                    <span className="text-[11px] text-zinc-400 group-hover:text-cyan-300 font-medium flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Insertar
                    </span>
                  </div>

                  {/* Icono / Mini Preview */}
                  <div className="my-3 p-3 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-center min-h-[65px] text-zinc-300">
                    <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-zinc-100 group-hover:text-cyan-200 transition-colors">
                      {preset.name}
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                      {preset.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
