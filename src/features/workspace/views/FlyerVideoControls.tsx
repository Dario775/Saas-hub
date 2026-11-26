"use client";

import type { FlyerVideo } from "@/lib/flyers/types";
import { CUSTOM_STYLE, MOTION_STYLES, STYLE_IDS, type MotionStyleChoice } from "@/lib/motion/styles";
import { Clapperboard, Loader2, Music2 } from "lucide-react";
import { useState } from "react";

const SECONDS = [10, 12, 15] as const;

interface FlyerVideoControlsProps {
  video?: FlyerVideo;
  disabled: boolean;
  onAnimate: (seconds: number, music: boolean, style: MotionStyleChoice) => Promise<void>;
}

/** Anima el flyer: duración, música y estado del video. */
export function FlyerVideoControls({ video, disabled, onAnimate }: FlyerVideoControlsProps) {
  const [seconds, setSeconds] = useState<number>(video?.seconds || 12);
  const [music, setMusic] = useState(video?.music ?? true);
  const [style, setStyle] = useState<MotionStyleChoice>("auto");
  const [sending, setSending] = useState(false);
  const running = video?.status === "running";

  async function animate() {
    setSending(true);
    try {
      await onAnimate(seconds, music, style);
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
        <select
          aria-label="Estilo del video"
          value={style}
          disabled={running}
          onChange={(event) => setStyle(event.target.value as MotionStyleChoice)}
          className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
        >
          <option value="auto">Estilo automático</option>
          <option value={CUSTOM_STYLE}>A medida · Claude lo diseña (~US$ 0,50)</option>
          {STYLE_IDS.map((id) => (
            <option key={id} value={id}>
              {MOTION_STYLES[id].label} · {MOTION_STYLES[id].bpm} BPM
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
      {running && video?.step && <p className="text-[11px] text-slate-400">{video.step}…</p>}
      {video?.status === "failed" && <p className="text-xs text-rose-300">{video.error || "No se pudo crear el video."}</p>}
      {video?.status === "done" && video.custom && video.concept && (
        <p className="text-[11px] text-slate-400">Diseñado por Claude: {video.concept}</p>
      )}
      {video?.status === "done" && video.style && (
        <p className="text-[11px] text-slate-500">
          Estilo {MOTION_STYLES[video.style].label.toLowerCase()} ({MOTION_STYLES[video.style].description.toLowerCase()}).
          {video.music && !video.track ? " Música generada: cada video suena distinto." : ""}
        </p>
      )}
    </div>
  );
}
