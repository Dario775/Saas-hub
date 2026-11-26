"use client";

import { designFromFlyer } from "@/components/composer/flyer-design";
import { CLAUDE_MODELS } from "@/lib/claude-models";
import type { FlyerExport } from "@/lib/flyers/flyer-layers";
import type { Flyer, FlyerFormat, FlyerJob } from "@/lib/flyers/types";
import { Download, Loader2, Send, Wand2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { WorkspaceController } from "../hooks/use-workspace";
import { FlyerCard } from "./FlyerCard";

const FORMATS: { id: FlyerFormat; label: string }[] = [
  { id: "4:5", label: "4:5 Feed" },
  { id: "1:1", label: "1:1 Cuadrado" },
  { id: "9:16", label: "9:16 Historia" },
];
/** Para idear y revisar conviene un modelo más capaz que el de uso diario. */
const DEFAULT_MODEL = "claude-sonnet-5-5";
const ACTIVE_PROVIDER = "panel-activo";
const POLL_MS = 3_000;

interface JobsResponse {
  success: boolean;
  jobs?: FlyerJob[];
  job?: FlyerJob;
  error?: string;
}

async function readResponse(response: Response): Promise<JobsResponse> {
  const data = (await response.json()) as JobsResponse;
  if (!response.ok || !data.success) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

export default function FlyersView({ controller }: { controller: WorkspaceController }) {
  const { pageId, currentBrand, setGeneratedImage, setMessage, setTab, setComposerInitialDesign } = controller;
  const brandId = pageId || currentBrand.id;
  const [brief, setBrief] = useState("");
  const [format, setFormat] = useState<FlyerFormat>("4:5");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [jobs, setJobs] = useState<FlyerJob[]>([]);
  const [starting, setStarting] = useState(false);
  const [revisingId, setRevisingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await readResponse(await fetch(`/api/flyers?brand=${encodeURIComponent(brandId)}`));
    setJobs(data.jobs || []);
  }, [brandId]);

  const running = jobs.some((job) => job.status === "running");
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      load().catch((error) => {
        if (!cancelled) toast.error("No se pudieron cargar los flyers", { description: messageOf(error) });
      });
    };
    const first = setTimeout(refresh, 0);
    const timer = running ? setInterval(refresh, POLL_MS) : undefined;
    return () => {
      cancelled = true;
      clearTimeout(first);
      if (timer) clearInterval(timer);
    };
  }, [load, running]);

  async function send(body: Record<string, unknown>): Promise<FlyerJob | undefined> {
    const response = await fetch("/api/flyers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, model, ...body }),
    });
    return (await readResponse(response)).job;
  }

  async function handleCreate() {
    setStarting(true);
    try {
      const job = await send({ brief, format });
      if (job) setJobs((current) => [job, ...current]);
    } catch (error) {
      toast.error("No se pudieron crear los flyers", { description: messageOf(error) });
    } finally {
      setStarting(false);
    }
  }

  async function handleRevise(job: FlyerJob, flyer: Flyer, instruction: string): Promise<boolean> {
    setRevisingId(flyer.id);
    try {
      const updated = await send({ action: "revise", jobId: job.id, flyerId: flyer.id, instruction });
      if (updated) setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      return true;
    } catch (error) {
      toast.error("No se pudo ajustar el flyer", { description: messageOf(error) });
      return false;
    } finally {
      setRevisingId(null);
    }
  }

  async function handleEdit(job: FlyerJob, flyer: Flyer) {
    try {
      const response = await fetch("/api/flyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", brandId, jobId: job.id, flyerId: flyer.id }),
      });
      const data = (await response.json()) as { success: boolean; design?: FlyerExport; error?: string };
      if (!response.ok || !data.design) throw new Error(data.error || "No se pudo separar el flyer en capas.");
      setComposerInitialDesign(designFromFlyer(data.design));
      if (flyer.concept.caption) setMessage(flyer.concept.caption);
      setTab("composer");
      toast.success("Flyer abierto en el editor", { description: "Cada texto es una capa editable." });
    } catch (error) {
      toast.error("No se pudo abrir en el editor", { description: messageOf(error) });
    }
  }

  async function handlePublish(flyer: Flyer) {
    try {
      const response = await fetch(`/api/flyers/image?id=${flyer.id}`);
      if (!response.ok) throw new Error("La imagen todavía no está lista.");
      const blob = await response.blob();
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
        reader.readAsDataURL(blob);
      });
      setGeneratedImage(image);
      if (flyer.concept.caption) setMessage(flyer.concept.caption);
      setTab("publish");
      toast.success("Flyer enviado a Publicaciones para que lo revises");
    } catch (error) {
      toast.error("No se pudo preparar la publicación", { description: messageOf(error) });
    }
  }

  return (
    <div className="space-y-6">
      <section className="hub-panel p-5 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="flyer-brief" className="text-xs font-semibold text-slate-300">
            ¿Qué querés comunicar?
          </label>
          <textarea
            id="flyer-brief"
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Ej.: ofrecemos integrar el stock, las ventas y la facturación de distribuidoras que hoy trabajan con planillas."
            className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500">
            Cuanto más concreto, mejor: a quién le hablás, qué le pasa y qué ofrecés. Si hay precio, descuento o plazo, escribilo: no se inventa.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div role="group" aria-label="Formato" className="flex gap-1.5">
            {FORMATS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={format === item.id}
                onClick={() => setFormat(item.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  format === item.id ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200" : "border-white/10 text-slate-400 hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="text-xs text-slate-400 flex items-center gap-2">
            Dirección creativa
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="rounded-lg border border-white/10 bg-[#121220] px-2 py-2 text-xs text-white"
            >
              {CLAUDE_MODELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} · {item.price}
                </option>
              ))}
              <option value={ACTIVE_PROVIDER}>IA activa del panel (sin revisión visual)</option>
            </select>
          </label>
          <button
            type="button"
            className="hub-button hub-button-primary ml-auto"
            disabled={starting || running || !brief.trim()}
            onClick={() => void handleCreate()}
          >
            {starting || running ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {running ? "Preparando…" : "Crear 4 propuestas"}
          </button>
        </div>
      </section>

      {jobs.length === 0 && (
        <p className="text-sm text-slate-400">Todavía no hay flyers de {currentBrand.name}. Escribí el primer pedido arriba.</p>
      )}

      {jobs.map((job) => (
        <section key={job.id} className="space-y-3" aria-busy={job.status === "running"}>
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200 line-clamp-2 max-w-3xl">{job.brief}</h2>
            <span className="text-xs text-slate-500">
              {new Date(job.createdAt).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {job.format}
            </span>
          </header>
          {job.status === "running" && (
            <p role="status" className="flex items-center gap-2 text-xs text-emerald-300">
              <Loader2 size={14} className="animate-spin" /> {job.step || "Preparando"}. Suele tardar entre 2 y 5 minutos.
            </p>
          )}
          {job.error && (
            <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {job.error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {job.flyers.map((flyer) => (
              <FlyerCard
                key={flyer.id}
                flyer={flyer}
                pending={job.status === "running"}
                revising={revisingId === flyer.id}
                disabled={running || revisingId !== null}
                onRevise={(instruction) => handleRevise(job, flyer, instruction)}
                onPublish={() => void handlePublish(flyer)}
                onEdit={() => handleEdit(job, flyer)}
                icons={{ download: <Download size={14} />, publish: <Send size={14} /> }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
