import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { buildTheme } from "../src/lib/flyers/theme";
import { findTemplate, FLYER_TEMPLATES } from "../src/lib/flyers/templates";
import { FLYER_SIZES, type Flyer, type FlyerBrand, type FlyerJob } from "../src/lib/flyers/types";
import { buildMotionHtml, COMPOSITION_ID, MOTION_BPM, motionTiming } from "../src/lib/motion/motion-html";
import { buildSoundtrack, SAMPLE_RATE } from "../src/lib/motion/sound";
import { MOTION_STYLES, resolveStyle, STYLE_IDS } from "../src/lib/motion/styles";
import { FLYER_SAMPLES } from "./flyer-samples";

const previousDirectory = process.cwd();
const directory = mkdtempSync(path.join(os.tmpdir(), "hub-motion-"));
let motion: typeof import("../src/lib/flyers/motion");
let store: typeof import("../src/lib/flyers/store");

const BRAND: FlyerBrand = {
  id: "marca",
  name: "Café <Alma>",
  website: "https://www.cafealma.com/",
  description: "",
  audience: "",
  valueProposition: "",
  voice: "",
  primary: "#0b2a4a",
  accent: "#22c3e6",
  headingFont: "Space Grotesk",
};

function context(concept = FLYER_SAMPLES[0]) {
  const { width, height } = FLYER_SIZES["4:5"];
  return {
    slots: concept.slots,
    theme: buildTheme(BRAND, concept.tone),
    width,
    height,
    brandName: BRAND.name,
    website: "cafealma.com",
    logoUrl: null,
    logoLightUrl: "data:image/png;base64,QUJD",
    logoDarkUrl: "data:image/png;base64,REVG",
    assetUrl: null,
  };
}

test("en cada tempo, la placa final entra justo en un tiempo y se llega a leer", () => {
  for (const { bpm } of Object.values(MOTION_STYLES)) {
    const beat = 60 / bpm;
    for (const seconds of [10, 12, 15]) {
      const { duration, outroStart, hook } = motionTiming(seconds, bpm);
      assert.equal(duration, seconds);
      assert.ok(duration - outroStart >= 2.4, `${bpm} BPM, ${seconds} s: la placa se llega a leer`);
      assert.ok(Math.abs(outroStart / beat - Math.round(outroStart / beat)) < 0.01, `${bpm} BPM, ${seconds} s: cae en un tiempo`);
      assert.ok(Math.abs(hook.scene - beat * 4) < 0.001 && Math.abs(hook.land - beat * 5) < 0.001, "el gancho dura un compás");
    }
  }
  assert.equal(motionTiming(10, 999).bpm, MOTION_BPM, "un tempo absurdo usa el de siempre");
  assert.equal(motionTiming(2).duration, 6);
  assert.equal(motionTiming(99).duration, 20);
  assert.equal(motionTiming(Number.NaN).duration, 6);
});

test("cada diseño se arma como composición de HyperFrames", () => {
  for (const concept of FLYER_SAMPLES) {
    const template = findTemplate(concept.template)!;
    const html = buildMotionHtml(template, context(concept), "Space Grotesk", { duration: 12, cta: "Escribinos" });
    assert.match(html, new RegExp(`data-composition-id="${COMPOSITION_ID}" data-width="1080" data-height="1350" data-duration="12"`), concept.template);
    assert.match(html, /id="scene" class="clip" data-start="0" data-duration="12" data-track-index="1"/);
    const timing = motionTiming(12);
    assert.ok(html.includes(`id="end" class="clip" data-start="${timing.outroStart}" data-duration="${(12 - timing.outroStart).toFixed(3)}" data-track-index="2"`));
    assert.ok(html.includes(`"bpm":${MOTION_BPM}`));
    assert.ok(html.includes(`"hook":{"scene":${timing.hook.scene},"land":${timing.hook.land}}`));
    assert.match(html, /"accent":"#[0-9a-f]{6}"/i, "el círculo hacia la marca usa el acento");
    assert.match(html, new RegExp(`"template":"${concept.template}"`));
    assert.doesNotMatch(html, /<audio/);
    assert.ok(html.indexOf("gsap.min.js") < html.indexOf("choreography.js"), "GSAP carga antes que la coreografía");
  }
  assert.equal(FLYER_SAMPLES.length, FLYER_TEMPLATES.length, "hay una muestra por diseño");
});

test("la placa final escapa los textos y usa el logo que se lee sobre el acento", () => {
  const html = buildMotionHtml(findTemplate("afirmacion")!, context(), "Space Grotesk", { duration: 10, cta: "Pedí <hoy>" });
  assert.match(html, /Café &lt;Alma&gt;/);
  assert.match(html, /Pedí &lt;hoy&gt;/);
  assert.doesNotMatch(html, /<Alma>/);
  // El acento es claro: va el logo con sus colores.
  assert.match(html, /<div class="outro"[^>]*><div class="out-mark"><span class="out-ring"><\/span><img src="data:image\/png;base64,REVG"/);
});

test("el sonido generado dura lo mismo que el video y sale igual con la misma semilla", () => {
  const plan = { duration: 10, bpm: MOTION_BPM, outroStart: 7.5, bed: true, seed: "flyer-1" };
  const wav = buildSoundtrack(plan);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(wav.readUInt32LE(40) / 4, Math.ceil(10 * SAMPLE_RATE));
  assert.ok(wav.equals(buildSoundtrack(plan)), "determinista");
  assert.ok(!wav.equals(buildSoundtrack({ ...plan, seed: "otro" })));
  // El impacto de la placa final suena fuerte: hay picos cerca del máximo justo después de 7,5 s.
  const at = 44 + Math.round(7.52 * SAMPLE_RATE) * 4;
  let peak = 0;
  for (let offset = 0; offset < SAMPLE_RATE * 0.1 * 4; offset += 4) peak = Math.max(peak, Math.abs(wav.readInt16LE(at + offset)));
  assert.ok(peak > 12_000, `impacto audible (${peak})`);
  // Con música propia van solo los efectos: el principio queda casi en silencio.
  const effects = buildSoundtrack({ ...plan, bed: false });
  let early = 0;
  for (let offset = 44 + Math.round(3 * SAMPLE_RATE) * 4; offset < 44 + Math.round(4 * SAMPLE_RATE) * 4; offset += 4)
    early = Math.max(early, Math.abs(effects.readInt16LE(offset)));
  assert.ok(early < 1_000, `sin ritmo de fondo (${early})`);
  // Cuando aterrizan las palabras del gancho suena un barrido con golpe.
  const accented = buildSoundtrack({ ...plan, bed: false, accents: [2.5] });
  let landing = 0;
  for (let offset = 44 + Math.round(2.3 * SAMPLE_RATE) * 4; offset < 44 + Math.round(2.6 * SAMPLE_RATE) * 4; offset += 4)
    landing = Math.max(landing, Math.abs(accented.readInt16LE(offset)));
  assert.ok(landing > 3_000, `acento audible (${landing})`);
});

test("cada estilo suena distinto y cada video cambia acordes y tonalidad", () => {
  const plan = { duration: 8, outroStart: 6, bed: true, seed: "flyer-1" };
  const sounds = STYLE_IDS.map((style) => buildSoundtrack({ ...plan, style, bpm: MOTION_STYLES[style].bpm }));
  for (let a = 0; a < sounds.length; a++)
    for (let b = a + 1; b < sounds.length; b++) assert.ok(!sounds[a].equals(sounds[b]), `${STYLE_IDS[a]} ≠ ${STYLE_IDS[b]}`);
  // Mismo estilo, otra semilla: otra música (no solo otro ruido de platillos).
  const one = buildSoundtrack({ ...plan, style: "corporativo", bpm: 100 });
  const other = buildSoundtrack({ ...plan, style: "corporativo", bpm: 100, seed: "flyer-2" });
  let difference = 0;
  for (let offset = 44; offset < one.length; offset += 4) difference += Math.abs(one.readInt16LE(offset) - other.readInt16LE(offset));
  assert.ok(difference / ((one.length - 44) / 4) > 300, "la diferencia es audible, no un detalle");
  // "auto" reparte estilos según la semilla.
  const picked = new Set(Array.from({ length: 40 }, (_, index) => resolveStyle("auto", `flyer-${index}`)));
  assert.equal(picked.size, STYLE_IDS.length);
  assert.equal(resolveStyle("tranquilo", "x"), "tranquilo");
});

test("la configuración embebida no puede cerrar el script", () => {
  const sample = { ...FLYER_SAMPLES[4], template: "afirmacion" };
  const html = buildMotionHtml({ ...findTemplate("afirmacion")!, id: "</script><b>" }, context(sample), "Inter Tight", { duration: 10, cta: "" });
  assert.doesNotMatch(html, /"template":"<\/script>/);
  assert.match(html, /\\u003c\/script>/);
});

before(async () => {
  // Los archivos de flyers se resuelven al importar: nunca los reales.
  process.chdir(directory);
  motion = await import("../src/lib/flyers/motion");
  store = await import("../src/lib/flyers/store");
});
after(() => {
  process.chdir(previousDirectory);
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
  } catch {
    // Ignorar bloqueo transitorio de temp en Windows
  }
});

test("la pista elegida es siempre la misma para un flyer", () => {
  const folder = path.join(directory, "pistas");
  mkdirSync(folder, { recursive: true });
  for (const name of ["b.mp3", "a.m4a", "notas.txt", "c.wav"]) writeFileSync(path.join(folder, name), "x");
  const first = motion.pickTrack(folder, "flyer-1");
  assert.ok(first && [".mp3", ".m4a", ".wav"].includes(path.extname(first)));
  assert.equal(motion.pickTrack(folder, "flyer-1"), first);
  assert.equal(motion.pickTrack(path.join(directory, "no-existe"), "x"), null);
  assert.equal(motion.readVideoSeconds(15), 15);
  assert.equal(motion.readVideoSeconds("13"), motion.DEFAULT_VIDEO_SECONDS);
});

const FLYER_ID = "11111111-2222-3333-4444-555555555555";
const JOB_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

async function seedJob(flyer: Partial<Flyer> = {}) {
  const job: FlyerJob = {
    id: JOB_ID,
    brandId: BRAND.id,
    brief: "x",
    format: "4:5",
    model: "m",
    status: "done",
    step: "",
    createdAt: "2026-11-26T00:00:00Z",
    flyers: [{ id: FLYER_ID, concept: FLYER_SAMPLES[4], format: "4:5", hasAsset: false, revision: 1, ...flyer }],
  };
  await store.mutateJobs(() => ({ jobs: [job], result: undefined }));
}

const videoOf = () => store.readJobs()[0].flyers[0].video;

function fakeEngine(fail = false) {
  const calls: { prepared?: string; rendered?: string; soundtrack?: string | null } = {};
  return {
    calls,
    engine: {
      prepare: (dir: string, workspace: { html: string }) => {
        mkdirSync(dir, { recursive: true });
        calls.prepared = workspace.html;
      },
      render: async (_dir: string, output: string) => {
        if (fail) throw new Error("Chrome no respondió");
        writeFileSync(output, "mudo");
        calls.rendered = output;
        return output;
      },
      finish: async (options: { soundtrack: string | null; output: string }) => {
        calls.soundtrack = options.soundtrack;
        writeFileSync(options.output, "video");
      },
      custom: async (input: { directory: string; prepare: (dir: string, workspace: { html: string }) => void; step: (text: string) => Promise<void> }) => {
        await input.step("Claude está diseñando el video");
        input.prepare(input.directory, { html: "<html>diseño de Claude</html>" });
        return { html: "<html>diseño de Claude</html>", concept: "La planilla se ordena sola", reviewed: [] };
      },
    },
  };
}

test("animar deja el video publicado en la biblioteca de medios", async () => {
  await seedJob();
  const { calls, engine } = fakeEngine();
  const { job, done } = await motion.animateFlyer({ jobId: JOB_ID, flyerId: FLYER_ID, brand: BRAND, seconds: 12, music: true }, engine);
  assert.equal(job.flyers[0].video?.status, "running");
  assert.equal(motion.isMotionBusy(), true);
  await done;
  const video = videoOf();
  assert.equal(video?.status, "done");
  assert.match(video?.url || "", new RegExp(`^/generated-videos/flyer-${FLYER_ID}-\\d+\\.mp4$`));
  assert.ok(existsSync(path.join(directory, "public", video!.url!)));
  assert.match(calls.prepared || "", /"template":"afirmacion"/);
  assert.match(calls.soundtrack || "", /sonido\.wav$/, "con sonido generado aunque no haya pistas");
  assert.ok(STYLE_IDS.includes(video!.style!), "guarda el estilo con el que se armó");
  assert.match(calls.prepared || "", new RegExp(`"bpm":${MOTION_STYLES[video!.style!].bpm}`), "la animación usa el tempo del estilo");
  assert.equal(video?.track, false);
  assert.equal(motion.isMotionBusy(), false);
});

test("a medida, Claude diseña el video y queda su idea", async () => {
  await seedJob();
  const { calls, engine } = fakeEngine();
  const { done } = await motion.animateFlyer({ jobId: JOB_ID, flyerId: FLYER_ID, brand: BRAND, seconds: 12, music: true, style: "medida" }, engine as never);
  await done;
  const video = videoOf();
  assert.equal(video?.status, "done");
  assert.equal(video?.custom, true);
  assert.equal(video?.concept, "La planilla se ordena sola");
  assert.equal(calls.prepared, "<html>diseño de Claude</html>", "no usa la coreografía fija");
  assert.ok(STYLE_IDS.includes(video!.style!), "la música sale de un estilo");
});

test("un video por vez, y solo de flyers terminados", async () => {
  await seedJob();
  const { engine } = fakeEngine();
  const first = await motion.animateFlyer({ jobId: JOB_ID, flyerId: FLYER_ID, brand: BRAND, seconds: 10, music: false }, engine);
  await assert.rejects(
    motion.animateFlyer({ jobId: JOB_ID, flyerId: FLYER_ID, brand: BRAND, seconds: 10, music: false }, engine),
    /Ya hay un video/,
  );
  await first.done;
  await seedJob({ revision: 0 });
  await assert.rejects(motion.animateFlyer({ jobId: JOB_ID, flyerId: FLYER_ID, brand: BRAND, seconds: 10, music: false }, engine), /todavía no está listo/);
});

test("si el render falla, el error queda a la vista y se puede reintentar", async () => {
  await seedJob();
  const { engine } = fakeEngine(true);
  const { done } = await motion.animateFlyer({ jobId: JOB_ID, flyerId: FLYER_ID, brand: BRAND, seconds: 10, music: false }, engine);
  await done;
  assert.equal(videoOf()?.status, "failed");
  assert.match(videoOf()?.error || "", /Chrome no respondió/);
  assert.equal(motion.isMotionBusy(), false);
});

test("un video en curso tras reiniciar el panel pasa a fallido", async () => {
  await seedJob({ video: { status: "running", seconds: 10, music: false } });
  const settled = motion.settleVideos(store.readJobs()[0]);
  assert.equal(settled.flyers[0].video?.status, "failed");
  assert.match(settled.flyers[0].video?.error || "", /interrumpió/);
});
