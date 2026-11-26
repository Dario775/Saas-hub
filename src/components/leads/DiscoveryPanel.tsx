"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { COMMERCIAL_CATEGORIES } from "@/lib/commercial-taxonomy";
import type { DiscoveryResult, LeadCandidate } from "@/lib/lead-discovery";
import { ALLOWED_RADIUS_KM, DEFAULT_RADIUS_KM } from "@/lib/overpass";
import { Loader2, MapPin, Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DiscoveryDetails } from "./DiscoveryDetails";

interface DiscoveryPanelProps {
  defaultLocation: string;
  /** Se llama después de agregar prospectos, para recargar la lista. */
  onImported: () => void | Promise<void>;
}

type Preview = Pick<
  DiscoveryResult,
  "areaName" | "candidates" | "metrics" | "errors" | "geocode" | "overpass"
>;

const REASON_LABELS: Record<LeadCandidate["reason"], string> = {
  accepted: "Listo para agregar",
  duplicate: "Ya está en tu lista",
  identity_conflict: "Se parece a un prospecto existente",
  weak_identity: "Datos insuficientes para identificarlo",
  missing_name: "Sin nombre comercial",
  missing_location: "Sin ubicación",
  missing_category: "Sin categoría",
  unsupported_category: "Categoría no soportada",
};

async function postDiscover<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/leads/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.success)
    throw new Error(data.detail || data.error || "No se pudo completar la búsqueda.");
  return data as T;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

function isImportable(candidate: LeadCandidate): boolean {
  return candidate.classification === "lead_accepted";
}

function contactOf(candidate: LeadCandidate): string {
  return (
    [candidate.address, candidate.city, candidate.phone, candidate.website || candidate.email]
      .filter(Boolean)
      .join(" · ") || "Sin datos de contacto publicados"
  );
}

export function DiscoveryPanel({ defaultLocation, onImported }: DiscoveryPanelProps) {
  const [category, setCategory] = useState(COMMERCIAL_CATEGORIES[0].id);
  const [location, setLocation] = useState(defaultLocation);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    if (!location.trim()) {
      setError("Ingresá una localidad para buscar.");
      return;
    }
    setBusy("preview");
    setError(null);
    setPreview(null);
    setSelected(new Set());
    try {
      const result = await postDiscover<Preview>({
        action: "preview",
        location: location.trim(),
        category,
        radiusKm,
      });
      setPreview(result);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    if (!preview || !selected.size) return;
    setBusy("import");
    setError(null);
    try {
      const chosen = preview.candidates.filter((item) => selected.has(item.sourceId));
      const result = await postDiscover<{ imported: string[] }>({
        action: "import",
        candidates: chosen,
        areaName: preview.areaName,
      });
      const imported = new Set(result.imported);
      setPreview({
        ...preview,
        candidates: preview.candidates.map((item) =>
          imported.has(item.sourceId)
            ? { ...item, classification: "candidate_rejected", reason: "duplicate" }
            : item,
        ),
      });
      setSelected(new Set());
      toast.success(
        imported.size === 1 ? "Se agregó 1 prospecto" : `Se agregaron ${imported.size} prospectos`,
      );
      await onImported();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  function toggle(sourceId: string) {
    const next = new Set(selected);
    if (!next.delete(sourceId)) next.add(sourceId);
    setSelected(next);
  }

  const importable = preview?.candidates.filter(isImportable) || [];
  const allSelected = importable.length > 0 && selected.size === importable.length;

  return (
    <Card className="bg-[#0b0b14] border-white/[0.08]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-white flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400" />
          Buscar por radio con vista previa
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Mirá los comercios de OpenStreetMap antes de sumarlos. No se guarda nada hasta que los
          agregues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void handlePreview();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="discovery-category" className="text-xs font-semibold text-slate-300">
              Categoría
            </label>
            <select
              id="discovery-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-8 w-full rounded-lg border border-white/10 bg-[#121220] px-2 text-sm text-white"
            >
              {COMMERCIAL_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="discovery-location" className="text-xs font-semibold text-slate-300">
              Localidad
            </label>
            <Input
              id="discovery-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ej. Salta, Argentina"
              className="bg-black/40 border-white/10 text-white text-sm"
            />
          </div>
          <div role="group" aria-labelledby="discovery-radius" className="space-y-1.5">
            <span id="discovery-radius" className="text-xs font-semibold text-slate-300">
              Radio
            </span>
            <div className="flex h-8 gap-1">
              {ALLOWED_RADIUS_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  aria-pressed={radiusKm === km}
                  onClick={() => setRadiusKm(km)}
                  className={`rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap ${
                    radiusKm === km
                      ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-200"
                      : "border-white/10 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={busy !== null} className="h-8 gap-1.5 text-xs">
            {busy === "preview" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            {busy === "preview" ? "Buscando…" : "Ver comercios"}
          </Button>
        </form>

        {busy === "preview" && (
          <p role="status" className="text-xs text-slate-400">
            Consultando servicios públicos gratuitos: puede tardar hasta un par de minutos.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </p>
        )}

        {preview && (
          <div className="space-y-3" aria-live="polite">
            {preview.errors.length > 0 && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 break-words">
                {preview.errors.join(" ")}
              </p>
            )}
            <DiscoveryDetails geocode={preview.geocode} overpass={preview.overpass} />
            {preview.candidates.length > 0 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-300">
                    {preview.metrics.candidatesFound} encontrados · {preview.candidates.length}{" "}
                    mostrados · {importable.length} para agregar
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!importable.length || busy !== null}
                      onClick={() =>
                        setSelected(
                          allSelected ? new Set() : new Set(importable.map((item) => item.sourceId)),
                        )
                      }
                      className="h-8 border-white/10 text-xs text-slate-300"
                    >
                      {allSelected ? "Quitar selección" : "Seleccionar todos"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!selected.size || busy !== null}
                      onClick={() => void handleImport()}
                      className="h-8 gap-1.5 text-xs"
                    >
                      {busy === "import" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      Agregar {selected.size || ""}
                    </Button>
                  </div>
                </div>
                <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10">
                  {preview.candidates.map((candidate) => (
                    <li key={candidate.sourceId}>
                      <label className="flex items-start gap-3 p-3 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selected.has(candidate.sourceId)}
                          disabled={!isImportable(candidate) || busy !== null}
                          onChange={() => toggle(candidate.sourceId)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-white break-words">
                            {candidate.name || "Sin nombre"}
                          </span>
                          <span className="block text-slate-400 break-words">
                            {contactOf(candidate)}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 max-w-[40%] text-right ${
                            isImportable(candidate) ? "text-emerald-300" : "text-slate-400"
                          }`}
                        >
                          {REASON_LABELS[candidate.reason]}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
