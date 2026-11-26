"use client";

import type { FlyerVideo } from "@/lib/flyers/types";
import { Clapperboard, Loader2, Music2 } from "lucide-react";
import { useState } from "react";

const SECONDS = [10, 12, 15] as const;

interface FlyerVideoControlsProps {
  video?: FlyerVideo;
  disabled: boolean;
  onAnimate: (seconds: number, music: boolean) => Promise<void>;
}

/** Anima el flyer: duración, música y estado del video. */
export function FlyerVideoControls({ video, disabled, onAnimate }: FlyerVideoControlsProps) {
  const [seconds, setSeconds] = useState<number>(video?.seconds || 12);
  const [music, setMusic] = useState(video?.music ?? true);
  const [sending, setSending] = useState(false);
  const running = video?.status === "running";

  async function animate() {
    setSending(true);
    try {
      await onAnimate(seconds, music);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2">
      <div className="flex items-center gap-2">
        <select
          aria-label="Duración del video"
          value={seconds}
          disabled={running}
          onChange={(event) => setSeconds(Number(event.target.value))}
          className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
        >
          {SECONDS.map((value) => (
            <option key={value} value={value}>
              {value} s
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input type="checkbox" checked={music} disabled={running} onChange={(event) => setMusic(event.target.checked)} />
          <Music2 size={12} aria-hidden="true" /> Sonido
        </label>
        <button
          type="button"
          disabled={disabled || running || sending}
          onClick={() => void animate()}
          className="hub-button hub-button-secondary ml-auto !px-3 !py-1.5"
        >
          {running || sending ? <Loader2 size={14} className="animate-spin" /> : <Clapperboard size={14} />}
          {running ? "Animando…" : video?.status === "done" ? "Rehacer video" : "Animar"}
        </button>
      </div>
      {video?.status === "failed" && <p className="text-xs text-rose-300">{video.error || "No se pudo crear el video."}</p>}
      {video?.status === "done" && video.music && !video.track && (
        <p className="text-[11px] text-slate-500">Con ritmo generado. Para usar tu música, agregá pistas libres de derechos en la carpeta motion-music.</p>
      )}
    </div>
  );
}
