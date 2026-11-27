"use client";

import type { Flyer, FlyerFormat } from "@/lib/flyers/types";
import { Layers3, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { MotionStyleChoice } from "@/lib/motion/styles";
import { FlyerPublications } from "./FlyerPublications";
import { FlyerVideoControls } from "./FlyerVideoControls";

interface FlyerCardProps {
  flyer: Flyer;
  pending: boolean;
  revising: boolean;
  disabled: boolean;
  onRevise: (instruction: string) => Promise<boolean>;
  onPublish: (media: "image" | "video") => void;
  /** Arma la versión animada del flyer. */
  onAnimate: (seconds: number, music: boolean, style: MotionStyleChoice) => Promise<void>;
  /** Abre el flyer en el editor de diseño, con los textos como capas. */
  onEdit: () => Promise<void>;
  icons: { download: ReactNode; publish: ReactNode };
}

const RATIO: Record<FlyerFormat, string> = { "4:5": "4 / 5", "1:1": "1 / 1", "9:16": "9 / 16" };

export function FlyerCard({ flyer, pending, revising, disabled, onRevise, onPublish, onAnimate, onEdit, icons }: FlyerCardProps) {
  const [instruction, setInstruction] = useState("");
  const [opening, setOpening] = useState(false);
  const ready = flyer.revision > 0;
  const source = `/api/flyers/image?id=${flyer.id}&v=${flyer.revision}`;
  const videoUrl = flyer.video?.status === "done" ? flyer.video.url : undefined;
  const [view, setView] = useState<"image" | "video">("image");
  const showVideo = view === "video" && Boolean(videoUrl);
  const media = showVideo ? "video" : "image";

  async function submit() {
    if (instruction.trim() && (await onRevise(instruction.trim()))) setInstruction("");
  }

  return (
    <article className="hub-panel overflow-hidden flex flex-col">
      <div className="relative bg-black/40" style={{ aspectRatio: RATIO[flyer.format] }}>
        {videoUrl && (
          <div className="absolute left-2 top-2 z-10 flex rounded-full bg-black/70 p-0.5 text-[11px]" role="group" aria-label="Ver imagen o video">
            {(["image", "video"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={`rounded-full px-2.5 py-1 ${view === option ? "bg-white text-black" : "text-slate-200"}`}
              >
                {option === "image" ? "Imagen" : "Video"}
              </button>
            ))}
          </div>
        )}
        {showVideo ? (
          <video key={videoUrl} src={videoUrl} controls autoPlay muted loop playsInline className="h-full w-full object-cover" />
        ) : ready ? (
          <a href={source} target="_blank" rel="noreferrer" aria-label="Ver el flyer en tamaño completo">
            {/* Imagen local ya optimizada: next/image no aporta acá. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={source} alt={`Flyer: ${flyer.concept.idea}`} className="h-full w-full object-cover" />
          </a>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-slate-400">
            {flyer.error || (pending ? <Loader2 className="animate-spin" aria-label="Preparando" /> : "No se generó")}
          </div>
        )}
        {revising && (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <Loader2 className="animate-spin" aria-label="Ajustando" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-3 flex-1 flex flex-col">
        <p className="text-xs text-slate-300 flex-1">{flyer.concept.idea}</p>
        {flyer.review && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer">Revisión de Claude: {flyer.review.score}/10</summary>
            {flyer.review.problems.length > 0 && (
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {flyer.review.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </details>
        )}
        {ready && (
          <>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <input
                aria-label="Pedir un ajuste"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                maxLength={600}
                placeholder="Más oscuro, cambiá el título…"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-slate-500"
              />
              <button type="submit" disabled={disabled || !instruction.trim()} className="hub-button hub-button-secondary !px-3 !py-1.5">
                Ajustar
              </button>
            </form>
            <button
              type="button"
              disabled={opening || revising}
              onClick={() => {
                setOpening(true);
                void onEdit().finally(() => setOpening(false));
              }}
              className="hub-button hub-button-secondary w-full !py-2"
            >
              {opening ? <Loader2 size={14} className="animate-spin" /> : <Layers3 size={14} />}
              {opening ? "Separando capas…" : "Editar en el editor de diseño"}
            </button>
            <FlyerPublications publications={flyer.publications} />
            <FlyerVideoControls video={flyer.video} disabled={revising} onAnimate={onAnimate} />
            <div className="flex gap-2">
              <a
                href={showVideo ? videoUrl : source}
                download={`flyer-${flyer.concept.template}.${showVideo ? "mp4" : "png"}`}
                className="hub-button hub-button-secondary flex-1 !py-2"
              >
                {icons.download} Descargar
              </a>
              <button type="button" onClick={() => onPublish(media)} className="hub-button hub-button-primary flex-1 !py-2">
                {icons.publish} {showVideo ? "Publicar video" : "Publicar"}
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
