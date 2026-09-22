"use client";

import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check,Image as ImageIcon,Layers,Loader2,Paintbrush,Scissors,Sparkles,Type,Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { removeSolidBackground } from "./canvas-renderer";
import { ImageEditorModal } from "./ImageEditorModal";
import { CanvasLayer } from "./types";

interface ComfyLayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLayerId?: string | null;
  layers: CanvasLayer[];
  onApplyImageToLayer: (layerId: string | null, imageUrl: string, promptUsed: string, generatorUsed: string) => void;
  brandContext?: any;
}

type LayerGenMode = "text-lettering" | "isolated-object" | "scene-background";

const GENERATORS_LIST = [
  { id: "flux-dev", name: "Flux 1 Dev (Recomendado para 3D & Textos)", speed: "⚡⚡", desc: "Realismo fotográfico y detalles épicos" },
  { id: "z-image-turbo", name: "Z-Image Turbo (Ultra Rápido)", speed: "⚡⚡⚡⚡", desc: "Generación en 3 a 5 segundos" },
  { id: "ideogram-4", name: "Ideogram 4 (Composición & Texto)", speed: "⚡⚡⚡", desc: "Excelente composición visual" },
  { id: "realvis-xl", name: "RealVis XL (Hiperrealismo)", speed: "⚡⚡", desc: "Texturas orgánicas y materiales reales" },
  { id: "gemini-2.5-flash-image", name: "Gemini Imagen 3 (Nube)", speed: "☁️ Nube", desc: "Generación sin requerir GPU local" },
  { id: "dall-e-3", name: "DALL-E 3 (OpenAI)", speed: "☁️ Nube", desc: "Creatividad visual artística" },
];

const LETTERING_STYLES = [
  { id: "cake", label: "🎂 Pastel con Glaseado", promptDesc: "made of a delicious gourmet birthday cake with colorful frosting, sprinkles, creamy texture, edible bakery art" },
  { id: "balloons", label: "🎈 Globos Inflados 3D", promptDesc: "made of glossy 3D foil metallic party balloons, inflated volumetric letters, reflective sheen" },
  { id: "neon", label: "⚡ Neón Brillante 3D", promptDesc: "made of glowing 3D neon glass tubes, electric radiant luminescence, soft colored aura" },
  { id: "gold", label: "🪙 Oro & Cromo Pulido", promptDesc: "sculpted from gleaming 24k polished gold with mirror chrome bevels, luxury premium reflections" },
  { id: "crystal", label: "💎 Cristal & Diamante", promptDesc: "carved from pristine transparent faceted crystal glass with iridescent light caustics and refractions" },
  { id: "gummy", label: "🍬 Gominola / Jelly", promptDesc: "made of translucent squishy gummy jelly candy, colorful gelatin, glossy wet specular highlights" },
  { id: "chocolate", label: "🍫 Chocolate Derretido", promptDesc: "sculpted from rich dark chocolate with glossy caramel drizzle and chocolate curls" },
  { id: "wood", label: "🪵 Madera Rústica Tallada", promptDesc: "crafted from rustic carved oak timber wood with rich natural grain, hand-carved craftsmanship" },
  { id: "cyberpunk", label: "🚀 Cyberpunk / Metal LED", promptDesc: "futuristic industrial titanium metal with glowing cyan and magenta LED circuit lines" },
];

export function ComfyLayerModal({
  isOpen,
  onClose,
  targetLayerId,
  layers,
  onApplyImageToLayer,
  brandContext,
}: ComfyLayerModalProps) {
  const [selectedLayerId, setSelectedLayerId] = useState<string>(targetLayerId || "new_layer");
  const [genMode, setGenMode] = useState<LayerGenMode>("text-lettering");
  const [letteringText, setLetteringText] = useState("50% OFF");
  const [selectedStyleId, setSelectedStyleId] = useState("cake");
  const [customDetails, setCustomDetails] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedGenerator, setSelectedGenerator] = useState("flux-dev");
  const [autoRemoveBg, setAutoRemoveBg] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cuttingBg, setCuttingBg] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  const [lastRawImage, setLastRawImage] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Construir prompt optimizado según el modo seleccionado
  function buildFinalPrompt(): string {
    if (genMode === "text-lettering") {
      const textToUse = letteringText.trim() || "50% OFF";
      const styleObj = LETTERING_STYLES.find((s) => s.id === selectedStyleId) || LETTERING_STYLES[0];
      const extra = customDetails.trim() ? `, ${customDetails.trim()}` : "";
      return `3D volumetric typography lettering spelling exact text "${textToUse}", ${styleObj.promptDesc}${extra}, isolated single object floating in center, clean edge contrast, pure dark solid background, studio product commercial photography, sharp focus, 8k resolution`;
    } else if (genMode === "isolated-object") {
      const extra = customDetails.trim() || "modern product";
      return `isolated single 3D object of ${extra}, studio lighting, floating in center on pure dark solid background, clean edge contrast, sharp focus, 8k render`;
    } else {
      return customPrompt.trim() || "cinematic abstract background with soft lighting, 8k resolution";
    }
  }

  async function handleGenerate() {
    const finalPrompt = buildFinalPrompt();

    setLoading(true);
    setGeneratedPreview(null);
    setLastRawImage(null);

    try {
      const resp = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          generator: selectedGenerator,
          width: 1024,
          height: 1024,
          brand: brandContext,
        }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.image) {
        throw new Error(data.error || data.detail || "Error al generar imagen con IA");
      }

      setLastRawImage(data.image);

      // Si tiene marcado auto recortar fondo y no es fondo de escena completo
      if (autoRemoveBg && genMode !== "scene-background") {
        try {
          const cutImage = await removeSolidBackground(data.image, 45);
          setGeneratedPreview(cutImage);
        } catch {
          setGeneratedPreview(data.image);
        }
      } else {
        setGeneratedPreview(data.image);
      }

      toast.success("¡Capa generada con éxito!");
    } catch (err: any) {
      toast.error("Error en la generación", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  // Quitar / Restaurar fondo manualmente en el preview
  async function handleToggleRemoveBg() {
    if (!lastRawImage) return;
    setCuttingBg(true);
    try {
      if (generatedPreview === lastRawImage) {
        const cut = await removeSolidBackground(lastRawImage, 45);
        setGeneratedPreview(cut);
        toast.success("Fondo eliminado a transparente");
      } else {
        setGeneratedPreview(lastRawImage);
        toast.info("Fondo original restaurado");
      }
    } catch (err: any) {
      toast.error("Error al procesar transparencia", { description: err.message });
    } finally {
      setCuttingBg(false);
    }
  }

  function handleApply() {
    if (!generatedPreview) return;
    const destId = selectedLayerId === "new_layer" ? null : selectedLayerId;
    const promptUsed = buildFinalPrompt();
    onApplyImageToLayer(destId, generatedPreview, promptUsed, selectedGenerator);
    toast.success("Capa insertada en el lienzo");
    onClose();
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
        <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 text-zinc-100 p-5">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-gradient-to-r from-cyan-600 to-blue-600">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <DialogTitle className="text-base font-bold text-zinc-100">
                Generar Capa / Lettering con IA
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-zinc-400">
              Crea textos artísticos 3D, objetos o fondos aislados con IA listos para montar sobre tu diseño.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-2">
            {/* Columna Izquierda: Configuración (7 cols) */}
            <div className="md:col-span-7 space-y-3">
              {/* Selector de Modo */}
              <div>
                <Label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                  Tipo de Capa a Crear:
                </Label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setGenMode("text-lettering")}
                    className={`p-2 rounded-lg border text-left text-xs transition-all ${
                      genMode === "text-lettering"
                        ? "bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Type className="w-3.5 h-3.5 text-amber-400" />
                      Lettering 3D
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Texto artístico sin fondo</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenMode("isolated-object")}
                    className={`p-2 rounded-lg border text-left text-xs transition-all ${
                      genMode === "isolated-object"
                        ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-200 shadow-sm"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Objeto / Sticker
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Elemento o producto</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenMode("scene-background")}
                    className={`p-2 rounded-lg border text-left text-xs transition-all ${
                      genMode === "scene-background"
                        ? "bg-purple-500/20 border-purple-500/60 text-purple-200 shadow-sm"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      Fondo Escénico
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Fondo completo</div>
                  </button>
                </div>
              </div>

              {/* MODO 1: LETTERING 3D */}
              {genMode === "text-lettering" && (
                <div className="space-y-2.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <div>
                    <Label className="text-xs text-amber-300 font-semibold">Texto a Renderizar en 3D:</Label>
                    <Input
                      value={letteringText}
                      onChange={(e) => setLetteringText(e.target.value)}
                      placeholder="Ej: 50% OFF, OFERTA, 2x1, PROMO, NUEVO"
                      className="mt-1 bg-zinc-950 border-zinc-700 text-sm font-bold text-amber-200 h-9 focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-zinc-400">Material y Estilo Artístico:</Label>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      {LETTERING_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setSelectedStyleId(style.id)}
                          className={`px-2 py-1.5 rounded text-[11px] font-medium border text-left truncate transition-all ${
                            selectedStyleId === style.id
                              ? "bg-amber-500/25 border-amber-400 text-amber-200"
                              : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-[11px] text-zinc-400">Detalles adicionales (Opcional):</Label>
                    <Input
                      value={customDetails}
                      onChange={(e) => setCustomDetails(e.target.value)}
                      placeholder="Ej: glaseado rosa pastel con velitas y confeti..."
                      className="mt-0.5 bg-zinc-950 border-zinc-800 text-xs h-7"
                    />
                  </div>
                </div>
              )}

              {/* MODO 2: OBJETO / PRODUCTO AISLADO */}
              {genMode === "isolated-object" && (
                <div className="space-y-2 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <Label className="text-xs text-cyan-300 font-semibold">Describe el Objeto / Sticker:</Label>
                  <Input
                    value={customDetails}
                    onChange={(e) => setCustomDetails(e.target.value)}
                    placeholder="Ej: frasco de perfume de lujo flotando con gotas de agua..."
                    className="bg-zinc-950 border-zinc-700 text-xs h-8 focus:border-cyan-400"
                  />
                </div>
              )}

              {/* MODO 3: FONDO COMPLETO */}
              {genMode === "scene-background" && (
                <div className="space-y-2 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <Label className="text-xs text-purple-300 font-semibold">Prompt para Fondo:</Label>
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                    placeholder="Ej: fondo de oficina moderna minimalista con iluminación suave y plantas..."
                    className="bg-zinc-950 border-zinc-700 text-xs focus:border-purple-400"
                  />
                </div>
              )}

              {/* Controles de Destino, Modelo y Transparencia */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <Label className="text-[11px] text-zinc-400">Modelo de IA:</Label>
                  <select
                    value={selectedGenerator}
                    onChange={(e) => setSelectedGenerator(e.target.value)}
                    className="w-full mt-1 h-8 bg-zinc-900 border border-zinc-800 rounded-md px-2 text-zinc-200"
                  >
                    {GENERATORS_LIST.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-[11px] text-zinc-400">Insertar en:</Label>
                  <select
                    value={selectedLayerId}
                    onChange={(e) => setSelectedLayerId(e.target.value)}
                    className="w-full mt-1 h-8 bg-zinc-900 border border-zinc-800 rounded-md px-2 text-zinc-200"
                  >
                    <option value="new_layer">✨ Crear como Nueva Capa</option>
                    {layers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.type === "background" ? "🖼️ Capa de Fondo" : `Capa: ${l.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checkbox de auto-recorte transparente */}
              {genMode !== "scene-background" && (
                <label className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/30 p-2 rounded-lg border border-emerald-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRemoveBg}
                    onChange={(e) => setAutoRemoveBg(e.target.checked)}
                    className="rounded accent-emerald-400 w-4 h-4"
                  />
                  <span className="font-medium">
                    ✂️ Recortar fondo automáticamente a PNG transparente
                  </span>
                </label>
              )}

              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold gap-1.5 h-10 shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Renderizando elemento 3D...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generar {genMode === "text-lettering" ? "Texto 3D" : "Capa"} con IA
                  </>
                )}
              </Button>
            </div>

            {/* Columna Derecha: Vista Previa (5 cols) */}
            <div className="md:col-span-5 flex flex-col items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 min-h-[300px]">
              <div className="w-full flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800">
                <span className="font-semibold">Vista Previa</span>
                {generatedPreview && (
                  <button
                    onClick={handleToggleRemoveBg}
                    disabled={cuttingBg}
                    className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-300 flex items-center gap-1 border border-zinc-700"
                  >
                    <Scissors className="w-3 h-3" />
                    {generatedPreview === lastRawImage ? "Quitar Fondo" : "Ver Original"}
                  </button>
                )}
              </div>

              <div className="flex-1 w-full flex items-center justify-center py-2">
                {loading ? (
                  <div className="flex flex-col items-center gap-2 text-zinc-400 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                    <span className="text-xs font-medium">Generando con {selectedGenerator}...</span>
                    <span className="text-[11px] text-zinc-500">Esto toma unos segundos</span>
                  </div>
                ) : generatedPreview ? (
                  <div className="w-full flex flex-col items-center gap-2">
                    {/* Contenedor con patrón de cuadrícula de transparencia para que se note el PNG sin fondo */}
                    <div
                      className="w-full h-44 rounded-lg border border-zinc-700 flex items-center justify-center p-2 overflow-hidden"
                      style={{
                        backgroundImage:
                          "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
                        backgroundSize: "16px 16px",
                        backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                        backgroundColor: "#09090b",
                      }}
                    >
                      <img
                        src={generatedPreview}
                        alt="Elemento IA"
                        className="max-h-full max-w-full object-contain drop-shadow-xl"
                      />
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Listo para insertar como capa flotante
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-zinc-500 text-center p-4">
                    <ImageIcon className="w-8 h-8 opacity-30" />
                    <span className="text-xs">Aquí verás tu texto 3D u objeto</span>
                    <span className="text-[10px] text-zinc-600">Presiona &quot;Generar&quot; para comenzar</span>
                  </div>
                )}
              </div>

              {generatedPreview && (
                <div className="w-full space-y-1.5 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setIsEditorOpen(true)}
                    className="w-full h-8 bg-cyan-950/40 border-cyan-700/60 hover:bg-cyan-900/60 text-cyan-300 text-xs gap-1.5"
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    Retocar / Pintar / Borrar Detalles
                  </Button>
                  <Button
                    onClick={handleApply}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1.5 h-9 shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                    Insertar en el Lienzo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor raster interno para retoques antes de insertar */}
      {isEditorOpen && generatedPreview && (
        <ImageEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          imageSrc={generatedPreview}
          onSave={(retouchedUrl) => {
            setGeneratedPreview(retouchedUrl);
            setIsEditorOpen(false);
          }}
          brandColors={brandContext?.colors}
        />
      )}
    </>
  );
}
