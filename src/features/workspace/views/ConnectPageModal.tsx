"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
CheckCircle2,
Eye,
EyeOff,
Loader2,
Plus,
XCircle,
} from "lucide-react";
import type { WorkspaceController } from "../hooks/use-workspace";
import { ModalFrame } from "../ModalFrame";
export default function ConnectPageModal({
  controller,
}: {
  controller: WorkspaceController;
}) {
  const {
    showConnectModal,
    setShowConnectModal,
    handleConnectPage,
    setNewPageToken,
    handleInspectToken,
    setShowTokenPlain,
    showTokenPlain,
    newPageToken,
    inspectingToken,
    newPageName,
    setNewPageName,
    newPageEmoji,
    setNewPageEmoji,
    newPageCategory,
    setNewPageCategory,
    newPageId,
    setNewPageId,
    newPageTestConnection,
    setNewPageTestConnection,
    connectingPage,
  } = controller;
  return (
    <>
      {" "}
      {showConnectModal && (
        <ModalFrame
          title="Conectar página"
          onClose={() => setShowConnectModal(false)}
        >
          <div className="relative w-full max-w-lg p-6 sm:p-7 rounded-2xl bg-[#0c0c14] border border-white/[0.09] shadow-[0_20px_60px_rgba(0,0,0,0.8)] space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                    Conectar Página de Facebook
                  </h3>
                  <p className="text-xs text-slate-400">
                    Vincula tu página mediante Graph API para publicar y
                    programar posts
                  </p>
                </div>
              </div>
              <button
                aria-label="Cerrar conexión de página"
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConnectPage} className="space-y-4">
              {/* Page Access Token - Primer campo con auto-detección */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-white/[0.02] border border-blue-500/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>Page Access Token</span>
                    <span className="text-red-400">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            const clean = text.trim();
                            setNewPageToken(clean);
                            handleInspectToken(clean);
                          }
                        } catch {}
                      }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                    >
                      Pegar y Detectar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTokenPlain(!showTokenPlain)}
                      className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      {showTokenPlain ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                      {showTokenPlain ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </div>
                <Textarea
                  placeholder="Pega aquí tu token permanente (EAA...)"
                  value={newPageToken}
                  onChange={(e) => setNewPageToken(e.target.value)}
                  rows={3}
                  className={`bg-white/[0.03] border-white/[0.08] text-slate-200 placeholder:text-slate-600 rounded-xl font-mono text-[11px] leading-tight focus:border-blue-500 ${
                    !showTokenPlain
                      ? "filter blur-[2px] hover:blur-none focus:blur-none transition-all"
                      : ""
                  }`}
                  required
                />
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-slate-500">
                    Token generado con permisos{" "}
                    <code className="text-purple-300">pages_manage_posts</code>.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleInspectToken()}
                    disabled={inspectingToken || !newPageToken.trim()}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 transition-all font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {inspectingToken ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <span>🔍</span>
                    )}
                    <span>
                      {inspectingToken
                        ? "Detectando..."
                        : "Auto-detectar Página"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Nombre y Emoji */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    Nombre de la Página{" "}
                    <span className="text-slate-500 font-normal">
                      (se auto-detecta)
                    </span>
                  </Label>
                  <Input
                    placeholder="Ej. Mi Marca Online"
                    value={newPageName}
                    onChange={(e) => setNewPageName(e.target.value)}
                    className="bg-white/[0.03] border-white/[0.08] text-slate-200 placeholder:text-slate-600 rounded-xl focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    Emoji
                  </Label>
                  <Input
                    value={newPageEmoji}
                    onChange={(e) => setNewPageEmoji(e.target.value)}
                    className="bg-white/[0.03] border-white/[0.08] text-center text-lg text-slate-200 rounded-xl px-1"
                    maxLength={4}
                  />
                </div>
              </div>

              {/* Selector rápido de emojis */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500 font-medium">
                  Sugeridos:
                </span>
                {[
                  "🚀",
                  "💼",
                  "🛍️",
                  "✨",
                  "🔥",
                  "🎯",
                  "📱",
                  "🌸",
                  "🧠",
                  "🔷",
                  "💡",
                  "🚚",
                ].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setNewPageEmoji(em)}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                      newPageEmoji === em
                        ? "bg-blue-500/20 border border-blue-500/40 text-white scale-110"
                        : "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] text-slate-300"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>

              {/* Categoría */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
                  Categoría o Nicho
                </Label>
                <Input
                  placeholder="Ej. Cargo & Freight Company, Marketing, SaaS..."
                  value={newPageCategory}
                  onChange={(e) => setNewPageCategory(e.target.value)}
                  className="bg-white/[0.03] border-white/[0.08] text-slate-200 placeholder:text-slate-600 rounded-xl focus:border-blue-500"
                />
              </div>

              {/* Facebook Page ID */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>
                    Facebook Page ID{" "}
                    <span className="text-slate-500 font-normal">
                      (canónico de Graph API)
                    </span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-normal">
                    ✓ Se resuelve solo del token
                  </span>
                </Label>
                <Input
                  placeholder="Ej. 1279638021904556 (se auto-detecta si lo dejas vacío)"
                  value={newPageId}
                  onChange={(e) => setNewPageId(e.target.value)}
                  className="bg-white/[0.03] border-white/[0.08] text-slate-200 placeholder:text-slate-600 rounded-xl font-mono text-xs focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Si dejas este campo vacío, el sistema extraerá automáticamente
                  el Page ID canónico directo de tu token para evitar errores de
                  ID de perfil global.
                </p>
              </div>

              {/* Checkbox Test Connection */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer hover:bg-white/[0.03] transition-colors">
                <input
                  type="checkbox"
                  checked={newPageTestConnection}
                  onChange={(e) => setNewPageTestConnection(e.target.checked)}
                  className="mt-0.5 rounded border-white/[0.2] bg-white/[0.05] text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-slate-200">
                    Verificar token con Graph API antes de guardar
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Valida en vivo con Meta que el token esté activo y tenga
                    permisos de publicación.
                  </p>
                </div>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowConnectModal(false)}
                  disabled={connectingPage}
                  className="text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={connectingPage}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold px-5 py-2.5 shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
                >
                  {connectingPage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verificando y Conectando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Conectar Página</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </ModalFrame>
      )}{" "}
    </>
  );
}
