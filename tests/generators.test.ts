import assert from "node:assert/strict";
import test from "node:test";

import { adaptPromptForModel, ROUTER, type Concept } from "../src/lib/concept-studio";
import { buildRichPrompt, GENERATORS, transparentPrompt, writesReliableText } from "../src/lib/generators";
import { renderSizeForAspect, renderSizeForCanvas, RENDER_SIZES } from "../src/lib/render-sizes";
import { ideogramPrompt } from "../src/lib/ideogram-prompt";
import { buildBackgroundRemovalWorkflow, removalResolution } from "../src/lib/background-removal";

type Workflow = Record<string, { class_type: string; inputs: Record<string, unknown> }>;

function build(id: keyof typeof GENERATORS, overrides: Record<string, number | string> = {}): Workflow {
  const generator = GENERATORS[id];
  return generator.buildWorkflow("prompt", { ...generator.defaultParams, ...overrides }, "");
}

function nodesOf(workflow: Workflow, type: string) {
  return Object.values(workflow).filter((node) => node.class_type === type);
}

/** Cada conexión debe apuntar a un nodo que existe. */
function assertConnected(workflow: Workflow) {
  for (const [id, node] of Object.entries(workflow))
    for (const [input, value] of Object.entries(node.inputs))
      if (Array.isArray(value) && typeof value[0] === "string" && typeof value[1] === "number")
        assert.ok(workflow[value[0]], `${id}.${input} apunta al nodo inexistente ${value[0]}`);
}

test("Qwen Image 2.1 builds the installed local workflow", () => {
  const generator = GENERATORS["qwen-image-2.1"];
  const workflow = generator.buildWorkflow(
    "A premium Buenos Aires campaign",
    { ...generator.defaultParams, width: 1450, height: 1450 },
    "blurry, malformed text",
  );

  assert.equal(workflow["1"].inputs.unet_name, "qwen_image_2.1_int8_convrot.safetensors");
  assert.equal(workflow["2"].inputs.clip_name, "qwen3vl_8b_int8_convrot.safetensors");
  assert.equal(workflow["3"].inputs.vae_name, "qwen_image_2.1_vae_bf16.safetensors");
  assert.equal(workflow["4"].class_type, "TextEncodeQwenImage21");
  assert.equal(workflow["4"].inputs.negative_prompt, "blurry, malformed text");
  assert.equal(workflow["5"].inputs.width, 1456);
  assert.equal(workflow["5"].inputs.height, 1456);
  assert.deepEqual(workflow["9"].inputs.images, ["8", 0]);
});

test("Z-Image usa el codificador y los pasos de la plantilla oficial", () => {
  const workflow = build("z-image-turbo");
  assert.equal(nodesOf(workflow, "CLIPLoader")[0].inputs.type, "lumina2");
  assert.equal(nodesOf(workflow, "KSampler")[0].inputs.steps, 8);
});

test("FLUX 2 Klein usa su propio codificador, VAE y latente", () => {
  const workflow = build("flux-2-klein");
  const clip = nodesOf(workflow, "CLIPLoader")[0].inputs;
  assert.equal(clip.type, "flux2");
  assert.equal(clip.clip_name, "qwen_3_8b_fp8mixed.safetensors");
  assert.equal(nodesOf(workflow, "VAELoader")[0].inputs.vae_name, "flux2-vae.safetensors");
  assert.equal(nodesOf(workflow, "EmptyFlux2LatentImage").length, 1);
  assert.equal(nodesOf(workflow, "Flux2Scheduler")[0].inputs.steps, 4);
  assert.ok(workflow["9"], "el panel busca la imagen en el nodo 9");
});

test("todos los flujos locales quedan conectados con y sin upscale", () => {
  for (const [id, generator] of Object.entries(GENERATORS)) {
    if (id.startsWith("gemini") || id.startsWith("dall-e")) continue;
    for (const upscale of ["ninguno", "ultrasharp", "realesrgan", "refinado"]) {
      const workflow = generator.buildWorkflow("prompt", { ...generator.defaultParams, upscale }, "");
      assertConnected(workflow);
      assert.equal(nodesOf(workflow, "SaveImage").length, 1, id);
    }
  }
});

test("el upscale entrega 2x, no 4x", () => {
  const workflow = build("z-image-turbo", { upscale: "ultrasharp" });
  assert.equal(nodesOf(workflow, "ImageScaleBy")[0].inputs.scale_by, 0.5);
  assert.deepEqual(workflow["10"].inputs.images, ["32", 0]);
});

test("el refinado de Z-Image agrega una segunda pasada suave", () => {
  const workflow = build("z-image-turbo", { upscale: "refinado" });
  const passes = nodesOf(workflow, "KSampler");
  assert.equal(passes.length, 2);
  assert.ok(passes.some((node) => node.inputs.denoise === 0.28));
});

test("Ideogram respeta el formato vertical exacto", () => {
  const workflow = build("ideogram-4", { width: 960, height: 1200 });
  assert.equal(nodesOf(workflow, "ResolutionSelector").length, 0);
  const values = Object.values(workflow).flatMap((node) => Object.values(node.inputs));
  assert.ok(values.includes(960));
  assert.ok(values.includes(1200));
});

test("la transparencia de Qwen no pasa por un upscale que la pierda", () => {
  const workflow = build("qwen-image-2.1", { transparent: 1, upscale: "ultrasharp" });
  assert.match(String(workflow["4"].inputs.prompt), /^This is an RGBA format image/);
  assert.equal(nodesOf(workflow, "ImageUpscaleWithModel").length, 0);
  assert.equal(transparentPrompt("una taza. ").split("..").length, 1);
});

test("solo se recomienda escribir texto con modelos que lo hacen bien", () => {
  assert.equal(writesReliableText("qwen-image-2.1"), true);
  for (const id of ["z-image-turbo", "flux-2-klein", "flux-dev", "realvis-xl"])
    assert.equal(writesReliableText(id), false, id);
});

test("con Qwen el título conserva mayúsculas y acentos", () => {
  const prompt = buildRichPrompt("laptop", "Diseñá tu web", "ninguno", "", "arriba", "ninguno", "modern-white", "", "clean-white", "", undefined, "qwen-image-2.1");
  assert.match(prompt, /reads "Diseñá tu web"/);
});

const concept: Concept = {
  strategyId: "x",
  conceptName: "x",
  headline: "Tu negocio online",
  subtitle: "",
  cta: "",
  visualPrompt: "a desk",
  negativePrompt: "",
  caption: "",
  modelHint: "escena",
};

test("el Estudio deja el titular para el editor, salvo texto en la escena", () => {
  for (const hint of ["escena", "fotorealista"] as const) {
    const prompt = adaptPromptForModel(concept, ROUTER[hint]);
    assert.doesNotMatch(prompt, /Tu negocio online/i);
    assert.match(prompt, /no text/);
  }
  assert.equal(ROUTER.texto, "qwen-image-2.1");
  assert.match(adaptPromptForModel(concept, ROUTER.texto), /Tu negocio online/);
});

test("los tamaños son múltiplos de 16 y respetan la proporción", () => {
  for (const [aspect, size] of Object.entries(RENDER_SIZES)) {
    const [w, h] = aspect.split(":").map(Number);
    assert.equal(size.width % 16, 0);
    assert.equal(size.height % 16, 0);
    assert.ok(Math.abs(size.width / size.height - w / h) < 0.02, aspect);
  }
  assert.deepEqual(renderSizeForAspect("inventado"), RENDER_SIZES["1:1"]);
  const banner = renderSizeForCanvas(1200, 628);
  assert.ok(Math.abs(banner.width / banner.height - 1200 / 628) < 0.05);
  assert.deepEqual(renderSizeForCanvas(0, 10), RENDER_SIZES["1:1"]);
});

test("el recorte usa la imagen subida y una resolución admitida", () => {
  const workflow = buildBackgroundRemovalWorkflow("foto.png", 1024);
  assertConnected(workflow as unknown as Workflow);
  assert.equal(workflow["20"].inputs.image, "foto.png");
  assert.equal(removalResolution(4000, 4000), 1536);
  assert.equal(removalResolution(100, 100), 512);
  assert.equal(removalResolution("x", null), 1024);
  assert.equal(removalResolution(1088, 1088) % 32, 0);
});

test("el prompt local de Ideogram sigue el esquema oficial", () => {
  const raw = ideogramPrompt({ subject: 'una "taza"', text: "Café del barrio", subtitle: "Desde 1990", width: 960, height: 1200 });
  const json = JSON.parse(raw);
  assert.deepEqual(Object.keys(json), ["aspect_ratio", "high_level_description", "compositional_deconstruction"]);
  assert.equal(json.aspect_ratio, "4:5");
  assert.ok(json.high_level_description.split(" ").length <= 50);
  assert.doesNotMatch(json.high_level_description, /"/);
  const texts = json.compositional_deconstruction.elements.filter((item: { type: string }) => item.type === "text");
  assert.deepEqual(texts.map((item: { text: string }) => item.text), ["Café del barrio", "Desde 1990"]);
  for (const item of json.compositional_deconstruction.elements)
    assert.ok(item.bbox[0] < item.bbox[2] && item.bbox[1] < item.bbox[3] && Math.max(...item.bbox) <= 1000);
  assert.doesNotMatch(ideogramPrompt({ subject: "taza", width: 1088, height: 1088 }), /"type":"text"/);
});
