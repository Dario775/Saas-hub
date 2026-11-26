import type { MotionStyle } from "./styles";
import {
  bass,
  clap,
  crackle,
  createTrack,
  fadeOut,
  hat,
  impact,
  kick,
  noiseSource,
  pad,
  pluck,
  randomSource,
  riser,
  swoosh,
  toWav,
  type Track,
} from "./synth";

export { SAMPLE_RATE } from "./synth";

/**
 * Banda sonora generada en código, sobre la misma grilla de tiempos que la
 * animación. Cada estilo tiene su arreglo; cada video, su tonalidad y su
 * secuencia de acordes (según la semilla), así que no se repite.
 */
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
  style?: MotionStyle;
}

type Quality = "M" | "m";
/** Secuencias de acordes: grado (semitonos desde la tónica) y calidad. */
const PROGRESSIONS: Array<Array<[number, Quality]>> = [
  [[0, "m"], [8, "M"], [3, "M"], [10, "M"]], // i VI III VII
  [[0, "M"], [7, "M"], [9, "m"], [5, "M"]], // I V vi IV
  [[9, "m"], [5, "M"], [0, "M"], [7, "M"]], // vi IV I V
  [[0, "m"], [5, "m"], [10, "M"], [3, "M"]], // i iv VII III
  [[0, "M"], [9, "m"], [5, "M"], [7, "M"]], // I vi IV V
];

/** Lleva una nota al registro pedido sin cambiar su nombre. */
function fold(note: number, low: number): number {
  let value = note;
  while (value < low) value += 12;
  while (value >= low + 12) value -= 12;
  return value;
}

interface Harmony {
  chords: number[][];
  roots: number[];
}

function harmony(random: () => number): Harmony {
  const progression = PROGRESSIONS[Math.floor(random() * PROGRESSIONS.length)];
  const key = 45 + Math.floor(random() * 7) - 3; // La ± 3 semitonos
  const chords = progression.map(([degree, quality]) =>
    [0, quality === "M" ? 4 : 3, 7].map((interval) => fold(key + degree + interval, 45)).sort((a, b) => a - b),
  );
  return { chords, roots: progression.map(([degree]) => fold(key + degree, 33)) };
}

interface Grid {
  beat: number;
  bar: number;
  /** Desde acá, un compás de tensión sin percusión hasta la marca. */
  dropAt: number;
  plan: SoundtrackPlan;
}

function grid(plan: SoundtrackPlan): Grid {
  const beat = 60 / plan.bpm;
  const bar = beat * BEATS_PER_BAR;
  return { beat, bar, dropAt: Math.max(bar, plan.outroStart - bar), plan };
}

/** Recorre cada tiempo: `at` en segundos, `step` número de tiempo, `playing` fuera del compás de tensión. */
function eachBeat(g: Grid, visit: (at: number, step: number, playing: boolean) => void): void {
  const beats = Math.floor(g.plan.duration / g.beat);
  for (let step = 0; step < beats; step++) {
    const at = step * g.beat;
    visit(at, step, at < g.dropAt || at >= g.plan.outroStart);
  }
}

function eachBar(g: Grid, visit: (at: number, index: number, length: number) => void): void {
  for (let at = 0, index = 0; at < g.plan.duration; at += g.bar, index++) visit(at, index, Math.min(g.bar, g.plan.duration - at) + 0.05);
}

const ARRANGEMENTS: Record<MotionStyle, (track: Track, g: Grid, h: Harmony, noise: () => number, random: () => number) => void> = {
  /** House: bombo en cada tiempo, platillo abierto a contratiempo, bajo saltando. */
  energetico(track, g, h, noise) {
    eachBar(g, (at, index, length) => pad(track, at, length, h.chords[index % 4], 0.035, at < g.dropAt ? g.beat : 0));
    eachBeat(g, (at, step, playing) => {
      const chord = Math.floor(at / g.bar) % 4;
      if (playing) kick(track, at, 0.95, 1.1);
      if (playing && step % 2 === 1) clap(track, at, 0.3, noise);
      if (at < g.plan.outroStart) hat(track, at + g.beat / 2, 0.2, noise, step % 2 ? 0.3 : -0.3, 22);
      if (playing) bass(track, at + g.beat / 2, h.roots[chord], g.beat * 0.45, 0.2);
    });
  },
  /** Pop: bombo en 1 y 3, palmas en 2 y 4, acordes amplios. */
  equilibrado(track, g, h, noise) {
    eachBar(g, (at, index, length) => pad(track, at, length, h.chords[index % 4], 0.05, at < g.dropAt ? g.beat * 2 : 0));
    eachBeat(g, (at, step, playing) => {
      const chord = Math.floor(at / g.bar) % 4;
      const inBar = step % BEATS_PER_BAR;
      if (playing && (inBar === 0 || inBar === 2)) kick(track, at, 0.9);
      if (playing && at > 0 && (inBar === 1 || inBar === 3)) clap(track, at, 0.32, noise);
      if (at < g.plan.outroStart) hat(track, at + g.beat / 2, 0.16, noise, step % 2 ? 0.35 : -0.35);
      if (playing && inBar === 0) bass(track, at, h.roots[chord], g.beat * 1.8, 0.16);
    });
  },
  /** Corporativo: arpegios limpios en corcheas, percusión liviana. */
  corporativo(track, g, h, noise) {
    eachBar(g, (at, index, length) => pad(track, at, length, h.chords[index % 4], 0.025, 0, true));
    eachBeat(g, (at, step, playing) => {
      const chord = h.chords[Math.floor(at / g.bar) % 4];
      const inBar = step % BEATS_PER_BAR;
      if (playing && (inBar === 0 || inBar === 2)) kick(track, at, 0.6, 0.8);
      for (let half = 0; half < 2; half++) {
        const note = chord[(step * 2 + half) % chord.length] + 12;
        pluck(track, at + (half * g.beat) / 2, note, 0.12, 5, half ? 0.25 : -0.25);
        if (at < g.plan.outroStart) hat(track, at + (half * g.beat) / 2, 0.05, noise, 0.2, 120);
      }
    });
  },
  /** Lo-fi: tempo lento, redoblante apagado, platillos con swing y crujido de vinilo. */
  tranquilo(track, g, h, noise, random) {
    eachBar(g, (at, index, length) => pad(track, at, length, h.chords[index % 4], 0.06, 0, true));
    crackle(track, g.plan.duration, random);
    eachBeat(g, (at, step, playing) => {
      const chord = h.chords[Math.floor(at / g.bar) % 4];
      const inBar = step % BEATS_PER_BAR;
      if (playing && inBar === 0) kick(track, at, 0.8, 0.7);
      if (playing && inBar === 2) kick(track, at + g.beat / 2, 0.6, 0.7);
      if (playing && (inBar === 1 || inBar === 3)) clap(track, at, 0.24, noise, 1);
      if (at < g.plan.outroStart) hat(track, at + g.beat * 0.62, 0.08, noise, 0.2, 60);
      if (inBar % 2 === 0) pluck(track, at, chord[(step / 2) % chord.length] + 12, 0.07, 3);
    });
  },
};

/** WAV estéreo de 16 bits con la banda sonora del video. */
export function buildSoundtrack(plan: SoundtrackPlan): Buffer {
  const track = createTrack(plan.duration);
  const noise = noiseSource(plan.seed);
  const random = randomSource(plan.seed);
  const g = grid(plan);
  if (plan.bed) ARRANGEMENTS[plan.style ?? "equilibrado"](track, g, harmony(random), noise, random);
  impact(track, 0, plan.bed ? 0.5 : 0.35, noise);
  for (const at of plan.accents ?? []) {
    if (at <= 0 || at >= plan.outroStart) continue;
    swoosh(track, at, noise);
    impact(track, at, 0.3, noise);
  }
  riser(track, Math.max(0, plan.outroStart - g.bar), plan.outroStart, noise);
  impact(track, plan.outroStart, 1, noise);
  fadeOut(track, plan.duration);
  return toWav(track);
}
