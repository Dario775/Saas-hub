import { createHash } from "node:crypto";

/**
 * Banda sonora generada en código, sobre la misma grilla de tiempos que la
 * animación: golpes en los tiempos, subida antes de la placa final e impacto
 * cuando entra la marca. No usa archivos ni servicios: siempre se puede usar.
 */
export const SAMPLE_RATE = 44_100;
const PEAK = 0.89;
const BEATS_PER_BAR = 4;

export interface SoundtrackPlan {
  duration: number;
  bpm: number;
  /** Segundo en el que entra la placa final. */
  outroStart: number;
  /** Con música propia van solo los efectos, sin ritmo ni acordes. */
  bed: boolean;
  /** Misma semilla, mismo sonido. */
  seed: string;
  /** Momentos en que algo aterriza (las palabras del gancho): barrido y golpe suave. */
  accents?: number[];
}

interface Track {
  left: Float32Array;
  right: Float32Array;
}

/** Generador pseudoaleatorio con semilla (mulberry32): el ruido sale igual siempre. */
function noiseSource(seed: string): () => number {
  let state = createHash("sha256").update(seed).digest().readUInt32BE(0);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return (((value ^ (value >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** Suma una voz al track. `voice` devuelve la muestra para el segundo t desde su inicio. */
function addVoice(track: Track, start: number, length: number, voice: (t: number) => number, pan = 0): void {
  const from = Math.max(0, Math.round(start * SAMPLE_RATE));
  const to = Math.min(track.left.length, Math.round((start + length) * SAMPLE_RATE));
  const leftGain = Math.min(1, 1 - pan);
  const rightGain = Math.min(1, 1 + pan);
  for (let index = from; index < to; index++) {
    const sample = voice((index - from) / SAMPLE_RATE);
    track.left[index] += sample * leftGain;
    track.right[index] += sample * rightGain;
  }
}

function kick(track: Track, at: number, gain: number): void {
  let phase = 0;
  addVoice(track, at, 0.45, (t) => {
    phase += (2 * Math.PI * (44 + 110 * Math.exp(-t * 30))) / SAMPLE_RATE;
    return Math.sin(phase) * Math.exp(-t * 8) * gain;
  });
}

function hat(track: Track, at: number, gain: number, noise: () => number, pan: number): void {
  let previous = 0;
  addVoice(
    track,
    at,
    0.07,
    (t) => {
      const sample = noise();
      const high = sample - previous;
      previous = sample;
      return high * Math.exp(-t * 75) * gain;
    },
    pan,
  );
}

function clap(track: Track, at: number, gain: number, noise: () => number): void {
  let low = 0;
  addVoice(track, at, 0.25, (t) => {
    const sample = noise();
    low += 0.35 * (sample - low);
    // Tres rebotes cortos y una cola: suena a palmas, no a ruido.
    const burst = t < 0.03 ? 0.6 + 0.4 * Math.cos(t * 2 * Math.PI * 100) : 1;
    return (sample - low) * burst * Math.exp(-t * 18) * gain;
  });
}

/** Acordes suaves: Am, F, C, G. Dos osciladores apenas desafinados abren el estéreo. */
const CHORDS = [
  [110, 130.81, 164.81],
  [87.31, 110, 130.81],
  [130.81, 164.81, 196],
  [98, 123.47, 146.83],
];

function pad(track: Track, at: number, length: number, chord: number[], gain: number, beat: number, duck: boolean): void {
  const attack = 0.25;
  const release = Math.min(0.5, length / 2);
  for (const [index, frequency] of chord.entries()) {
    for (const side of [-1, 1]) {
      const detuned = frequency + side * 0.7;
      addVoice(
        track,
        at,
        length,
        (t) => {
          const envelope = Math.min(1, t / attack) * Math.min(1, (length - t) / release);
          // El acorde se agacha en cada golpe: le deja lugar al bombo.
          const sinceBeat = t % (beat * 2);
          const pump = duck ? 1 - 0.55 * Math.exp(-sinceBeat * 9) : 1;
          const tone = Math.sin(2 * Math.PI * detuned * t) + 0.25 * Math.sin(4 * Math.PI * detuned * t);
          return tone * envelope * pump * gain * (index === 0 ? 1.2 : 1);
        },
        side * 0.6,
      );
    }
  }
}

/** Ruido que se abre y sube de tono hasta la placa final. */
function riser(track: Track, from: number, to: number, noise: () => number): void {
  const length = to - from;
  if (length <= 0.2) return;
  let low = 0;
  let phase = 0;
  addVoice(track, from, length, (t) => {
    const progress = t / length;
    low += (0.02 + 0.5 * progress * progress) * (noise() - low);
    phase += (2 * Math.PI * (220 + 900 * progress * progress)) / SAMPLE_RATE;
    return (low * 0.9 + Math.sin(phase) * 0.12) * progress * progress * 0.55;
  });
}

/** Golpe grave con cola: marca un cambio de escena. */
function impact(track: Track, at: number, gain: number, noise: () => number): void {
  kick(track, at, 1.1 * gain);
  let low = 0;
  addVoice(track, at, 1.4, (t) => {
    low += 0.08 * (noise() - low);
    const boom = Math.sin(2 * Math.PI * 48 * t) * Math.exp(-t * 2.6) * 0.7;
    return (low * 2.2 * Math.exp(-t * 5) + boom) * gain;
  });
}

/** Barrido de aire que termina justo cuando algo aterriza. */
function swoosh(track: Track, end: number, noise: () => number): void {
  const length = Math.min(0.7, end);
  let low = 0;
  addVoice(track, end - length, length + 0.12, (t) => {
    const progress = Math.min(1, t / length);
    low += (0.04 + 0.3 * progress) * (noise() - low);
    const tail = t > length ? Math.exp(-(t - length) * 30) : 1;
    return low * Math.pow(progress, 3) * tail * 0.9;
  });
}

function addBed(track: Track, plan: SoundtrackPlan, noise: () => number): void {
  const beat = 60 / plan.bpm;
  const bar = beat * BEATS_PER_BAR;
  // El último compás antes de la marca queda solo con la subida: tensión.
  const dropAt = Math.max(bar, plan.outroStart - bar);
  for (let start = 0, index = 0; start < plan.duration; start += bar, index++) {
    const length = Math.min(bar, plan.duration - start);
    pad(track, start, length + 0.05, CHORDS[index % CHORDS.length], 0.05, beat, start < dropAt);
  }
  const beats = Math.floor(plan.duration / beat);
  for (let step = 0; step < beats; step++) {
    const at = step * beat;
    const inBar = step % BEATS_PER_BAR;
    const playing = at < dropAt || at >= plan.outroStart;
    if (playing && (inBar === 0 || inBar === 2)) kick(track, at, 0.9);
    if (playing && at > 0 && (inBar === 1 || inBar === 3)) clap(track, at, 0.32, noise);
    if (at < plan.outroStart) hat(track, at + beat / 2, 0.16, noise, step % 2 ? 0.35 : -0.35);
  }
}

function fadeEdges(track: Track, duration: number): void {
  const fade = Math.round(0.4 * SAMPLE_RATE);
  const total = Math.min(track.left.length, Math.round(duration * SAMPLE_RATE));
  for (let index = Math.max(0, total - fade); index < total; index++) {
    const gain = (total - index) / fade;
    track.left[index] *= gain;
    track.right[index] *= gain;
  }
}

function toWav(track: Track): Buffer {
  let peak = 0;
  for (let index = 0; index < track.left.length; index++)
    peak = Math.max(peak, Math.abs(track.left[index]), Math.abs(track.right[index]));
  const scale = peak > 0 ? PEAK / peak : 0;
  const frames = track.left.length;
  const buffer = Buffer.alloc(44 + frames * 4);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + frames * 4, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(frames * 4, 40);
  for (let index = 0; index < frames; index++) {
    buffer.writeInt16LE(Math.round(track.left[index] * scale * 32767), 44 + index * 4);
    buffer.writeInt16LE(Math.round(track.right[index] * scale * 32767), 46 + index * 4);
  }
  return buffer;
}

/** WAV estéreo de 16 bits con la banda sonora del video. */
export function buildSoundtrack(plan: SoundtrackPlan): Buffer {
  const frames = Math.ceil(plan.duration * SAMPLE_RATE);
  const track: Track = { left: new Float32Array(frames), right: new Float32Array(frames) };
  const noise = noiseSource(plan.seed);
  const bar = (60 / plan.bpm) * BEATS_PER_BAR;
  if (plan.bed) addBed(track, plan, noise);
  impact(track, 0, plan.bed ? 0.5 : 0.35, noise);
  for (const at of plan.accents ?? []) {
    if (at <= 0 || at >= plan.outroStart) continue;
    swoosh(track, at, noise);
    impact(track, at, 0.3, noise);
  }
  riser(track, Math.max(0, plan.outroStart - bar), plan.outroStart, noise);
  impact(track, plan.outroStart, 1, noise);
  fadeEdges(track, plan.duration);
  return toWav(track);
}
