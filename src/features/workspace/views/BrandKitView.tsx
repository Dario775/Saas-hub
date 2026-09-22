"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Database, Loader2, Plus, Save, Sparkles, XCircle } from "lucide-react";
import type { WorkspaceController } from "../hooks/use-workspace";
export default function BrandKitView({
  controller,
}: {
  controller: WorkspaceController;
}) {
  const {
    tab,
    draftBrand,
    extractUrl,
    setExtractUrl,
    handleExtractBrand,
    extracting,
    setDraftBrand,
    handleUpdateBrand,
  } = controller;
  return (
    <>
      {" "}
      {tab === "brandkit" && draftBrand && (
        <div className="animate-fadeIn space-y-6 pb-20">
          <div className="flex flex-col gap-6">
            {/* 1. Magia con IA (Full Width Top) */}
            <div className="premium-glass-card rounded-2xl p-6 space-y-4 relative overflow-hidden bg-purple-500/5 border-purple-500/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[40px] pointer-events-none" />
              <h3 className="text-sm font-bold text-purple-300 border-b border-purple-500/10 pb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Magia con IA
              </h3>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    URL del Sitio Web
                  </Label>
                  <Input
                    value={extractUrl}
                    onChange={(e) => setExtractUrl(e.target.value)}
                    placeholder="Ej: https://mi-empresa.com"
                    className="bg-white/[0.02] border-white/[0.05] text-slate-200 text-xs rounded-xl h-10"
                  />
                </div>
                <Button
                  onClick={handleExtractBrand}
                  disabled={extracting || !extractUrl}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold h-10 rounded-xl"
                >
                  {extracting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Auto-completar"
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Pega la URL de tu empresa y el sistema extraerá automáticamente el logotipo, icono, colores corporativos, tono de voz y directrices visuales, guardándolos en la memoria permanente del sistema.
              </p>
            </div>

            {/* 2. Dos Columnas: Identidad Verbal y Visual */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna Izquierda: Identidad Verbal */}
              <div className="space-y-6">
                {/* Información Básica / Identidad Verbal */}
                <div className="premium-glass-card rounded-2xl p-6 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[50px] pointer-events-none" />
                  <h3 className="text-sm font-bold text-slate-200 border-b border-white/[0.05] pb-2">
                    Identidad Verbal
                  </h3>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Nombre de la Marca
                    </Label>
                    <Input
                      value={draftBrand.name}
                      onChange={(e) =>
                        setDraftBrand({ ...draftBrand, name: e.target.value })
                      }
                      placeholder="Ej: Mi Hamburguesería"
                      className="bg-white/[0.02] border-white/[0.05] text-slate-200 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Descripción del Negocio
                    </Label>
                    <Textarea
                      value={draftBrand.projectDescription || ""}
                      onChange={(e) =>
                        setDraftBrand({
                          ...draftBrand,
                          projectDescription: e.target.value,
                        })
                      }
                      placeholder="Ej: SaaS de Inteligencia Artificial para B2B"
                      className="bg-white/[0.02] border-white/[0.05] text-slate-200 text-xs rounded-xl min-h-[60px]"
                    />
                  </div>
                  <div className="space-y-1.5 mt-4">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Público Objetivo
                    </Label>
                    <Textarea
                      value={draftBrand.targetAudience || ""}
                      onChange={(e) =>
                        setDraftBrand({
                          ...draftBrand,
                          targetAudience: e.target.value,
                        })
                      }
                      placeholder="Ej: Jóvenes de 18 a 25 interesados en moda"
                      className="bg-white/[0.02] border-white/[0.05] text-slate-200 text-xs rounded-xl min-h-[60px]"
                    />
                  </div>
                  <div className="space-y-1.5 mt-4">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Propuesta de Valor
                    </Label>
                    <Textarea
                      value={draftBrand.valueProposition || ""}
                      onChange={(e) =>
                        setDraftBrand({
                          ...draftBrand,
                          valueProposition: e.target.value,
                        })
                      }
                      placeholder="Ej: La entrega de comida más rápida de la ciudad"
                      className="bg-white/[0.02] border-white/[0.05] text-slate-200 text-xs rounded-xl min-h-[60px]"
                    />
                  </div>
                  <div className="space-y-1.5 mt-4">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Tono de Voz
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(val: string | null) => {
                          if (val && val !== "otro" && draftBrand)
                            setDraftBrand({ ...draftBrand, voiceTone: val });
                        }}
                      >
                        <SelectTrigger className="w-[140px] bg-white/[0.02] border-white/[0.05] text-slate-200 text-xs rounded-xl h-10 shrink-0">
                          <SelectValue placeholder="Predefinidos" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-slate-300">
                          <SelectItem value="Profesional y corporativo, tono formal">
                            Profesional
                          </SelectItem>
                          <SelectItem value="Divertido, fresco, usa emojis y jerga juvenil">
                            Divertido
                          </SelectItem>
                          <SelectItem value="Empático, cercano, educativo e inspirador">
                            Empático
                          </SelectItem>
                          <SelectItem value="otro">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={draftBrand.voiceTone}
                        onChange={(e) =>
                          setDraftBrand({
                            ...draftBrand,
                            voiceTone: e.target.value,
                          })
                        }
                        placeholder="Ej: Fresco, juvenil..."
                        className="bg-white/[0.02] border-white/[0.05] text-slate-200 text-xs rounded-xl h-10 flex-1"
                      />
                    </div>
                    <p className="text-[9px] text-slate-500">
                      Instrucciones para cuando la IA redacte publicaciones o
                      captions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Identidad Visual */}
              <div className="space-y-6">
                {/* Logos */}
                <div className="premium-glass-card rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 border-b border-white/[0.05] pb-2">
                    Activos Visuales (Logos)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Logo Principal
                      </Label>
                      <div className="h-24 rounded-xl bg-white/[0.01] border border-dashed border-white/10 flex items-center justify-center relative group cursor-pointer overflow-hidden">
                        {draftBrand.logoDataUrl ? (
                          <>
                            <img
                              src={draftBrand.logoDataUrl}
                              alt="Main Logo"
                              className="h-16 object-contain"
                            />
                            <button
                              onClick={() =>
                                setDraftBrand({
                                  ...draftBrand,
                                  logoDataUrl: undefined,
                                })
                              }
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-red-400 transition-opacity"
                            >
                              Eliminar
                            </button>
                          </>
                        ) : (
                          <>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const r = new FileReader();
                                  r.onload = (ev) =>
                                    ev.target?.result &&
                                    setDraftBrand({
                                      ...draftBrand,
                                      logoDataUrl: ev.target.result as string,
                                      logoPreset: "ninguno",
                                    });
                                  r.readAsDataURL(file);
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center text-slate-500">
                              <Plus className="w-5 h-5 mb-1" />{" "}
                              <span className="text-[9px]">Subir Logo</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Logo Secundario / Icono
                      </Label>
                      <div className="h-24 rounded-xl bg-white/[0.01] border border-dashed border-white/10 flex items-center justify-center relative group cursor-pointer overflow-hidden">
                        {draftBrand.secondaryLogoUrl ? (
                          <>
                            <img
                              src={draftBrand.secondaryLogoUrl}
                              alt="Secondary Logo"
                              className="h-16 object-contain"
                            />
                            <button
                              onClick={() =>
                                setDraftBrand({
                                  ...draftBrand,
                                  secondaryLogoUrl: undefined,
                                })
                              }
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-red-400 transition-opacity"
                            >
                              Eliminar
                            </button>
                          </>
                        ) : (
                          <>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const r = new FileReader();
                                  r.onload = (ev) =>
                                    ev.target?.result &&
                                    setDraftBrand({
                                      ...draftBrand,
                                      secondaryLogoUrl: ev.target
                                        .result as string,
                                    });
                                  r.readAsDataURL(file);
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center text-slate-500">
                              <Plus className="w-5 h-5 mb-1" />{" "}
                              <span className="text-[9px]">
                                Subir Alternativo
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colores */}
                <div className="premium-glass-card rounded-2xl p-6 space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[50px] pointer-events-none" />
                  <h3 className="text-sm font-bold text-slate-200 border-b border-white/[0.05] pb-2">
                    Paleta de Colores
                  </h3>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Colores Principales
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      {draftBrand.colors.primary.map((color, i) => (
                        <div
                          key={`p-${i}`}
                          className="group relative flex items-center gap-2 bg-white/[0.02] p-1 pr-2 rounded-full border border-white/[0.05]"
                        >
                          <div
                            className="w-8 h-8 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden cursor-pointer relative"
                            style={{ backgroundColor: color }}
                          >
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => {
                                const newColors = [
                                  ...draftBrand.colors.primary,
                                ];
                                newColors[i] = e.target.value;
                                setDraftBrand({
                                  ...draftBrand,
                                  colors: {
                                    ...draftBrand.colors,
                                    primary: newColors,
                                  },
                                });
                              }}
                              className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                            />
                          </div>
                          <input
                            type="text"
                            value={color}
                            onChange={(e) => {
                              const newColors = [...draftBrand.colors.primary];
                              newColors[i] = e.target.value;
                              setDraftBrand({
                                ...draftBrand,
                                colors: {
                                  ...draftBrand.colors,
                                  primary: newColors,
                                },
                              });
                            }}
                            className="bg-transparent border-none text-xs text-slate-300 w-16 focus:ring-0 uppercase font-mono"
                          />
                          <button
                            onClick={() => {
                              const newColors =
                                draftBrand.colors.primary.filter(
                                  (_, index) => index !== i,
                                );
                              setDraftBrand({
                                ...draftBrand,
                                colors: {
                                  ...draftBrand.colors,
                                  primary: newColors,
                                },
                              });
                            }}
                            className="bg-red-500/20 hover:bg-red-500 rounded-full p-1 transition-colors"
                          >
                            <XCircle className="w-3 h-3 text-red-300 group-hover:text-white" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setDraftBrand({
                            ...draftBrand,
                            colors: {
                              ...draftBrand.colors,
                              primary: [
                                ...draftBrand.colors.primary,
                                "#000000",
                              ],
                            },
                          });
                        }}
                        className="h-10 px-3 rounded-full border-2 border-dashed border-white/20 flex items-center gap-2 hover:bg-white/5 transition-colors cursor-pointer text-[10px] text-slate-400 font-bold uppercase"
                      >
                        <Plus className="w-3 h-3" /> Añadir
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Colores Secundarios
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      {draftBrand.colors.secondary.map((color, i) => (
                        <div
                          key={`s-${i}`}
                          className="group relative flex items-center gap-2 bg-white/[0.02] p-1 pr-2 rounded-full border border-white/[0.05]"
                        >
                          <div
                            className="w-6 h-6 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden cursor-pointer relative"
                            style={{ backgroundColor: color }}
                          >
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => {
                                const newColors = [
                                  ...draftBrand.colors.secondary,
                                ];
                                newColors[i] = e.target.value;
                                setDraftBrand({
                                  ...draftBrand,
                                  colors: {
                                    ...draftBrand.colors,
                                    secondary: newColors,
                                  },
                                });
                              }}
                              className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                            />
                          </div>
                          <input
                            type="text"
                            value={color}
                            onChange={(e) => {
                              const newColors = [
                                ...draftBrand.colors.secondary,
                              ];
                              newColors[i] = e.target.value;
                              setDraftBrand({
                                ...draftBrand,
                                colors: {
                                  ...draftBrand.colors,
                                  secondary: newColors,
                                },
                              });
                            }}
                            className="bg-transparent border-none text-[10px] text-slate-300 w-14 focus:ring-0 uppercase font-mono"
                          />
                          <button
                            onClick={() => {
                              const newColors =
                                draftBrand.colors.secondary.filter(
                                  (_, index) => index !== i,
                                );
                              setDraftBrand({
                                ...draftBrand,
                                colors: {
                                  ...draftBrand.colors,
                                  secondary: newColors,
                                },
                              });
                            }}
                            className="bg-red-500/20 hover:bg-red-500 rounded-full p-0.5 transition-colors"
                          >
                            <XCircle className="w-3 h-3 text-red-300 group-hover:text-white" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setDraftBrand({
                            ...draftBrand,
                            colors: {
                              ...draftBrand.colors,
                              secondary: [
                                ...draftBrand.colors.secondary,
                                "#ffffff",
                              ],
                            },
                          });
                        }}
                        className="h-8 px-3 rounded-full border border-dashed border-white/20 flex items-center gap-2 hover:bg-white/5 transition-colors cursor-pointer text-[10px] text-slate-400 font-bold uppercase"
                      >
                        <Plus className="w-3 h-3" /> Añadir
                      </button>
                    </div>
                  </div>
                </div>

                {/* Fuentes */}
                <div className="premium-glass-card rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 border-b border-white/[0.05] pb-2">
                    Tipografía
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Títulos (Heading)
                      </Label>
                      <Select
                        value={draftBrand?.typography?.heading || "Montserrat"}
                        onValueChange={(val: string | null) => {
                          if (val && draftBrand) {
                            setDraftBrand({
                              ...draftBrand,
                              typography: {
                                heading: val,
                                body: draftBrand.typography?.body || "Inter",
                              },
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white/[0.02] border-white/[0.05] h-9 text-xs rounded-xl px-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-xs max-h-60">
                          <SelectItem value="Montserrat">
                            <span style={{ fontFamily: "Montserrat" }}>
                              Montserrat
                            </span>
                          </SelectItem>
                          <SelectItem value="Inter">
                            <span style={{ fontFamily: "Inter" }}>Inter</span>
                          </SelectItem>
                          <SelectItem value="Playfair Display">
                            <span style={{ fontFamily: "Playfair Display" }}>
                              Playfair Display
                            </span>
                          </SelectItem>
                          <SelectItem value="Poppins">
                            <span style={{ fontFamily: "Poppins" }}>
                              Poppins
                            </span>
                          </SelectItem>
                          <SelectItem value="Space Grotesk">
                            <span style={{ fontFamily: "Space Grotesk" }}>
                              Space Grotesk
                            </span>
                          </SelectItem>
                          <SelectItem value="Outfit">
                            <span style={{ fontFamily: "Outfit" }}>Outfit</span>
                          </SelectItem>
                          <SelectItem value="Roboto">
                            <span style={{ fontFamily: "Roboto" }}>Roboto</span>
                          </SelectItem>
                          <SelectItem value="Arial">
                            <span style={{ fontFamily: "Arial" }}>Arial</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Cuerpo (Body)
                      </Label>
                      <Select
                        value={draftBrand?.typography?.body || "Inter"}
                        onValueChange={(val: string | null) => {
                          if (val && draftBrand) {
                            setDraftBrand({
                              ...draftBrand,
                              typography: {
                                heading:
                                  draftBrand.typography?.heading ||
                                  "Montserrat",
                                body: val,
                              },
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white/[0.02] border-white/[0.05] h-9 text-xs rounded-xl px-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0b0b14] border-white/[0.08] rounded-xl text-xs max-h-60">
                          <SelectItem value="Inter">
                            <span style={{ fontFamily: "Inter" }}>Inter</span>
                          </SelectItem>
                          <SelectItem value="Roboto">
                            <span style={{ fontFamily: "Roboto" }}>Roboto</span>
                          </SelectItem>
                          <SelectItem value="Montserrat">
                            <span style={{ fontFamily: "Montserrat" }}>
                              Montserrat
                            </span>
                          </SelectItem>
                          <SelectItem value="Open Sans">
                            <span style={{ fontFamily: "Open Sans" }}>
                              Open Sans
                            </span>
                          </SelectItem>
                          <SelectItem value="Outfit">
                            <span style={{ fontFamily: "Outfit" }}>Outfit</span>
                          </SelectItem>
                          <SelectItem value="Poppins">
                            <span style={{ fontFamily: "Poppins" }}>
                              Poppins
                            </span>
                          </SelectItem>
                          <SelectItem value="Arial">
                            <span style={{ fontFamily: "Arial" }}>Arial</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4 p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] text-center">
                    <h4
                      style={{
                        fontFamily: draftBrand.typography.heading,
                        fontSize: "1.25rem",
                        fontWeight: "bold",
                      }}
                      className="mb-2 text-slate-100"
                    >
                      Así se ven tus Títulos
                    </h4>
                    <p
                      style={{
                        fontFamily: draftBrand.typography.body,
                        fontSize: "0.85rem",
                      }}
                      className="text-slate-400"
                    >
                      Y así se verá el cuerpo de texto en tus diseños. Asegúrate
                      de usar tipografías legibles.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Barra de Acción Inferior: Guardar y Estado */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md mt-6">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">
                    Identidad Activa y Persistente
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Se guarda en <code className="text-purple-300 font-mono">brands.json</code> y se inyecta automáticamente en Estudio Creativo, Diseñador y Generador.
                  </div>
                </div>
              </div>
              <Button
                onClick={() => draftBrand && handleUpdateBrand(draftBrand)}
                disabled={!draftBrand}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.02]"
              >
                <Save className="w-4 h-4" /> Guardar Identidad de Marca
              </Button>
            </div>
          </div>
        </div>
      )}{" "}
    </>
  );
}
