"use client";

import type { FlyerPublication } from "@/lib/flyers/types";
import { CalendarClock, CheckCircle2, ExternalLink, XCircle } from "lucide-react";

const MAX_SHOWN = 3;

const LOOK: Record<FlyerPublication["status"], { label: string; className: string; icon: typeof CheckCircle2 }> = {
  published: { label: "Publicada", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", icon: CheckCircle2 },
  scheduled: { label: "Programada", className: "border-sky-400/30 bg-sky-400/10 text-sky-300", icon: CalendarClock },
  failed: { label: "Falló", className: "border-rose-400/30 bg-rose-400/10 text-rose-300", icon: XCircle },
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Dónde salió (o va a salir) el flyer: imagen y video por separado. */
export function FlyerPublications({ publications }: { publications?: FlyerPublication[] }) {
  if (!publications?.length) return null;
  const shown = publications.slice(0, MAX_SHOWN);
  const more = publications.length - shown.length;
  return (
    <ul className="space-y-1" aria-label="Publicaciones de este flyer">
      {shown.map((item, index) => {
        const look = LOOK[item.status];
        const Icon = look.icon;
        return (
          <li key={`${item.media}-${item.at}-${index}`} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${look.className}`}>
            <Icon size={12} aria-hidden="true" />
            <span className="font-medium">
              {item.media === "video" ? "Video" : "Imagen"} · {look.label.toLowerCase()}
            </span>
            <span className="text-slate-400">{when(item.at)}</span>
            {item.permalink && (
              <a href={item.permalink} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-0.5 hover:underline">
                Ver <ExternalLink size={10} aria-hidden="true" />
              </a>
            )}
          </li>
        );
      })}
      {more > 0 && <li className="text-[11px] text-slate-500">y {more} más en el calendario</li>}
    </ul>
  );
}
