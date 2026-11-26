import assert from "node:assert/strict";
import test from "node:test";
import { buildTheme } from "../src/lib/flyers/theme";
import { designCustomVideo, type DesignerDeps } from "../src/lib/motion/custom/designer";
import { buildCustomHtml, CUSTOM_CSP } from "../src/lib/motion/custom/document";
import { designUserPrompt, type DesignBrief } from "../src/lib/motion/custom/prompt";
import { checkDesign, parseDesign } from "../src/lib/motion/custom/validate";
import { readStyleChoice, resolveStyle, STYLE_IDS } from "../src/lib/motion/styles";

const GOOD = `<concept>La planilla se desarma y se ordena sola</concept>
<css>#stage{background:#0b2a4a} #stage .t{position:absolute;left:80px;top:200px;font-size:120px;color:#fff}</css>
<html><div class="t">Tres señales</div><img class="logo" src="logo-blanco.png" alt=""></html>
<script>
const tl = gsap.timeline({ paused: true });
window.__timelines = window.__timelines || {};
window.__timelines["flyer"] = tl;
tl.from("#stage .t", { yPercent: 100, opacity: 0, duration: 0.6, ease: "expo.out" }, 0);
</script>`;

const FILES = ["logo-blanco.png", "logo-color.png"];

test("un diseño correcto pasa el control", () => {
  const { design, problems } = parseDesign(GOOD);
  assert.deepEqual(problems, []);
  assert.equal(design!.concept, "La planilla se desarma y se ordena sola");
  assert.deepEqual(checkDesign(design!, FILES), []);
});

test("el control rechaza lo que podría romper el video o salir de la PC", () => {
  const bad = (script: string, extra: { css?: string; html?: string } = {}) => {
    const { design } = parseDesign(GOOD);
    return checkDesign({ ...design!, script: `${design!.script}\n${script}`, css: extra.css ?? design!.css, html: extra.html ?? design!.html }, FILES).join(" ");
  };
  assert.match(bad("tl.to('#x', { x: Math.random() * 10 }, 1);"), /Math\.random/);
  assert.match(bad("fetch('/datos');"), /red/);
  assert.match(bad("setTimeout(() => {}, 10);"), /temporizadores/);
  assert.match(bad("const t = Date.now();"), /hora del sistema/);
  assert.match(bad("eval('1');"), /eval/);
  assert.match(bad("tl.to('#x', { x: 10, repeat: -1 }, 1);"), /infinitas/);
  assert.match(bad("", { css: "#stage{animation: giro 1s}" }), /animaciones o transiciones CSS/);
  assert.match(bad("", { html: '<img src="https://otro.com/a.png">' }), /internet/);
  assert.match(bad("", { html: '<div onclick="x()">a</div>' }), /evento/);
  assert.match(bad("", { html: '<script src="x.js"></script>' }), /etiquetas no permitidas/);
  assert.match(bad("", { html: '<img src="foto-inventada.png">' }), /foto-inventada\.png/);
  const unregistered = parseDesign(GOOD.replace('window.__timelines["flyer"] = tl;', "")).design!;
  assert.match(checkDesign(unregistered, FILES).join(" "), /No registra la línea/);
  assert.match(parseDesign("<concept>x</concept><html>y</html>").problems.join(" "), /<script>/);
});

test("el documento final lleva la política de seguridad y el escenario del tamaño pedido", () => {
  const html = buildCustomHtml({ design: parseDesign(GOOD).design!, width: 1080, height: 1920, duration: 12, font: "Space Grotesk", title: "Café <Alma>" });
  assert.ok(html.includes(`content="${CUSTOM_CSP}"`));
  assert.match(CUSTOM_CSP, /connect-src 'none'/);
  assert.match(html, /data-composition-id="flyer" data-width="1080" data-height="1920" data-duration="12"/);
  assert.match(html, /<div id="stage"><div class="t">Tres señales<\/div>/);
  assert.match(html, /<title>Café &lt;Alma&gt;<\/title>/);
  assert.ok(html.indexOf("gsap.min.js") < html.indexOf('window.__timelines["flyer"]'));
});

const BRIEF: DesignBrief = {
  brandName: "Obsidiana",
  website: "obsidiana.com.ar",
  cta: "Escribinos",
  width: 1080,
  height: 1350,
  duration: 12,
  bpm: 110,
  outroStart: 9.273,
  theme: buildTheme({ primary: "#0f172a", accent: "#7c5cff" }, "oscuro"),
  headingFont: "Inter Tight",
  bodyFont: "Inter Tight",
  logos: { onDark: "logo-blanco.png", onLight: "logo-color.png" },
  template: "pasos",
  idea: "ordenar el stock",
  slots: { titular: "Tres señales", pasos: ["Uno", "Dos"] },
};

test("el pedido a Claude lleva marca, tempo, textos, archivos y placa final", () => {
  const prompt = designUserPrompt(BRIEF);
  assert.match(prompt, /1080 × 1350 px. Duración: 12 s/);
  assert.match(prompt, /110 BPM \(un tiempo = 0\.545 s/);
  assert.match(prompt, /logo-blanco\.png: logo para fondos oscuros/);
  assert.match(prompt, /- titular: Tres señales/);
  assert.match(prompt, /• Uno/);
  assert.match(prompt, /PLACA FINAL \(obligatoria\): desde 9\.273 s/);
});

function fakeDeps(responses: string[], review: string, validation: string[][] = []) {
  const calls = { design: 0, review: 0, writes: 0, steps: [] as string[] };
  const deps: DesignerDeps = {
    design: async () => responses[calls.design++] ?? GOOD,
    review: async () => {
      calls.review++;
      return review;
    },
    write: () => void calls.writes++,
    validate: async () => validation.shift() ?? [],
    sheet: async () => Buffer.from("jpg"),
    step: async (text) => void calls.steps.push(text),
  };
  return { deps, calls };
}

test("si el primer diseño no pasa, Claude lo corrige; si la revisión ve problemas, lo ajusta", async () => {
  const broken = GOOD.replace("duration: 0.6", "duration: Math.random()");
  const { deps, calls } = fakeDeps([broken, GOOD, GOOD.replace("Tres señales", "Tres señales claras")], '{"ok":false,"problems":["2 s: el título se corta"]}');
  const result = await designCustomVideo(BRIEF, { directory: "x", files: FILES, font: "Inter Tight" }, deps);
  assert.equal(calls.design, 3, "diseño, corrección y ajuste");
  assert.equal(calls.review, 1);
  assert.deepEqual(result.reviewed, ["2 s: el título se corta"]);
  assert.match(result.html, /Tres señales claras/);
  assert.deepEqual(calls.steps, ["Claude está diseñando el video", "Corrigiendo el diseño", "Revisando el borrador", "Ajustando lo que vio la revisión"]);
});

test("un error en Chrome también se corrige, y si la revisión aprueba no se gasta otra consulta", async () => {
  const { deps, calls } = fakeDeps([GOOD, GOOD], '{"ok":true,"problems":[]}', [["ReferenceError: x is not defined"]]);
  const result = await designCustomVideo(BRIEF, { directory: "x", files: FILES, font: "Inter Tight" }, deps);
  assert.equal(calls.design, 2);
  assert.equal(result.concept, "La planilla se desarma y se ordena sola");
  assert.deepEqual(result.reviewed, []);
});

test("si Claude no logra un diseño válido, el error explica por qué", async () => {
  const broken = GOOD.replace('window.__timelines["flyer"] = tl;', "");
  const { deps, calls } = fakeDeps([broken, broken, broken], "{}");
  await assert.rejects(designCustomVideo(BRIEF, { directory: "x", files: FILES, font: "Inter Tight" }, deps), /no logró un diseño que funcione: No registra/);
  assert.equal(calls.design, 3, "un intento y dos correcciones, no más");
  assert.equal(calls.review, 0);
});

test("a medida usa música de un estilo elegido al azar", () => {
  assert.equal(readStyleChoice("medida"), "medida");
  assert.equal(readStyleChoice("cualquiera"), "auto");
  assert.ok(STYLE_IDS.includes(resolveStyle("medida", "semilla")));
});
