import { createHash } from "node:crypto";

/** Instrumentos sintetizados en código: sin muestras ni archivos de audio. */
export const SAMPLE_RATE = 44_100;
const PEAK = 0.89;

export interface Track {
  left: Float32Array;
  right: Float32Array;
}

export function createTrack(seconds: number): Track {
  const frames = Math.ceil(seconds * SAMPLE_RATE);
  return { left: new Float32Array(frames), right: new Float32Array(frames) };
}

/** Generador pseudoaleatorio con semilla (mulberry32), en [0, 1). */
export function randomSource(seed: string): () => number {
  let state = createHash("sha256").update(seed).digest().readUInt32BE(0);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function noiseSource(seed: string): () => number {
  const random = randomSource(`${seed}:ruido`);
  return () => random() * 2 - 1;
}

export function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Suma una voz al track. `voice` devuelve la muestra para el segundo t desde su inicio. */
export function addVoice(track: Track, start: number, length: number, voice: (t: number) => number, pan = 0): void {
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

export function kick(track: Track, at: number, gain: number, punch = 1): void {
  let phase = 0;
  addVoice(track, at, 0.45, (t) => {
    phase += (2 * Math.PI * (44 + 110 * punch * Math.exp(-t * 30))) / SAMPLE_RATE;
    return Math.sin(phase) * Math.exp(-t * 8) * gain;
  });
}

/** Platillo: ruido agudo. `decay` alto = cerrado; bajo = abierto. */
export function hat(track: Track, at: number, gain: number, noise: () => number, pan: number, decay = 75): void {
  let previous = 0;
  addVoice(
    track,
    at,
    Math.min(0.5, 6 / decay),
    (t) => {
      const sample = noise();
      const high = sample - previous;
      previous = sample;
      return high * Math.exp(-t * decay) * gain;
    },
    pan,
  );
}

/** Palmas o redoblante. `warmth` (0–1) les saca brillo, para el lo-fi. */
export function clap(track: Track, at: number, gain: number, noise: () => number, warmth = 0): void {
  let low = 0;
  let soft = 0;
  addVoice(track, at, 0.25, (t) => {
    const sample = noise();
    low += 0.35 * (sample - low);
    const bright = sample - low;
    soft += (0.6 - warmth * 0.45) * (bright - soft);
    const burst = t < 0.03 ? 0.6 + 0.4 * Math.cos(t * 2 * Math.PI * 100) : 1;
    return soft * burst * Math.exp(-t * 18) * gain;
  });
}

/** Acorde sostenido. `pump` lo agacha en cada golpe del bombo. */
export function pad(track: Track, at: number, length: number, notes: number[], gain: number, pumpEvery: number, warm = false): void {
  const attack = warm ? 0.45 : 0.25;
  const release = Math.min(0.5, length / 2);
  for (const [index, note] of notes.entries()) {
    for (const side of [-1, 1]) {
      const frequency = midiToHz(note) + side * 0.7;
      addVoice(
        track,
        at,
        length,
        (t) => {
          const envelope = Math.min(1, t / attack) * Math.max(0, Math.min(1, (length - t) / release));
          const pump = pumpEvery ? 1 - 0.55 * Math.exp(-(t % pumpEvery) * 9) : 1;
          const overtone = warm ? 0 : 0.25 * Math.sin(4 * Math.PI * frequency * t);
          return (Math.sin(2 * Math.PI * frequency * t) + overtone) * envelope * pump * gain * (index === 0 ? 1.2 : 1);
        },
        side * 0.6,
      );
    }
  }
}

/** Nota pulsada (piano eléctrico simple): ataque rápido y caída. */
export function pluck(track: Track, at: number, note: number, gain: number, decay: number, pan = 0): void {
  const frequency = midiToHz(note);
  addVoice(
    track,
    at,
    Math.min(1.5, 5 / decay),
    (t) => {
      const tone = Math.sin(2 * Math.PI * frequency * t) + 0.3 * Math.sin(4 * Math.PI * frequency * t) * Math.exp(-t * 12);
      return tone * Math.min(1, t * 400) * Math.exp(-t * decay) * gain;
    },
    pan,
  );
}

/** Bajo con algo de armónicos (diente de sierra suavizado). */
export function bass(track: Track, at: number, note: number, length: number, gain: number): void {
  const frequency = midiToHz(note);
  addVoice(track, at, length, (t) => {
    let tone = 0;
    for (let harmonic = 1; harmonic <= 4; harmonic++) tone += Math.sin(2 * Math.PI * frequency * harmonic * t) / harmonic;
    const envelope = Math.min(1, t * 200) * Math.min(1, Math.max(0, (length - t) / 0.04)) * Math.exp(-t * 2);
    return tone * envelope * gain;
  });
}

/** Ruido que se abre y sube de tono hasta un momento clave. */
export function riser(track: Track, from: number, to: number, noise: () => number): void {
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
export function impact(track: Track, at: number, gain: number, noise: () => number): void {
  kick(track, at, 1.1 * gain);
  let low = 0;
  addVoice(track, at, 1.4, (t) => {
    low += 0.08 * (noise() - low);
    const boom = Math.sin(2 * Math.PI * 48 * t) * Math.exp(-t * 2.6) * 0.7;
    return (low * 2.2 * Math.exp(-t * 5) + boom) * gain;
  });
}

/** Barrido de aire que termina justo cuando algo aterriza. */
export function swoosh(track: Track, end: number, noise: () => number): void {
  const length = Math.min(0.7, end);
  let low = 0;
  addVoice(track, end - length, length + 0.12, (t) => {
    const progress = Math.min(1, t / length);
    low += (0.04 + 0.3 * progress) * (noise() - low);
    const tail = t > length ? Math.exp(-(t - length) * 30) : 1;
    return low * Math.pow(progress, 3) * tail * 0.9;
  });
}

/** Crujido de vinilo: clics sueltos y suaves. */
export function crackle(track: Track, seconds: number, random: () => number): void {
  const clicks = Math.floor(seconds * 9);
  for (let index = 0; index < clicks; index++) {
    const at = random() * seconds;
    const gain = 0.02 + random() * 0.04;
    addVoice(track, at, 0.004, (t) => (random() * 2 - 1) * gain * (1 - t / 0.004));
  }
}

export function fadeOut(track: Track, seconds: number, fade = 0.4): void {
  const length = Math.round(fade * SAMPLE_RATE);
  const total = Math.min(track.left.length, Math.round(seconds * SAMPLE_RATE));
  for (let index = Math.max(0, total - length); index < total; index++) {
    const gain = (total - index) / length;
    track.left[index] *= gain;
    track.right[index] *= gain;
  }
}

/** WAV estéreo de 16 bits, normalizado al pico. */
export function toWav(track: Track): Buffer {
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
