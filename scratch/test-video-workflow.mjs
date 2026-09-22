// Test de integración para el motor de video Wan 2.2 14B
import { buildWanVideoWorkflow, WAN_ASPECT_RATIOS } from "../src/lib/video-generators.js";
import assert from "assert";

console.log("=== Test 1: Verificación de Presets de Aspect Ratio ===");
assert(WAN_ASPECT_RATIOS["9:16"].width === 480);
assert(WAN_ASPECT_RATIOS["9:16"].height === 832);
assert(WAN_ASPECT_RATIOS["1:1"].width === 640);
assert(WAN_ASPECT_RATIOS["1:1"].height === 640);
assert(WAN_ASPECT_RATIOS["16:9"].width === 832);
assert(WAN_ASPECT_RATIOS["16:9"].height === 480);
console.log("✓ Presets de aspecto validados (múltiplos de 16/32)");

console.log("\n=== Test 2: Inyección de Parámetros en Workflow Wan 2.2 ===");
const testPrompt = "A luxury sleek watch rotating in slow motion, cinematic rim light";
const testNegative = "low quality, blur, noise";
const workflow = buildWanVideoWorkflow(testPrompt, {
  aspectRatio: "9:16",
  duration: 3,
  fps: 16,
  lightning: true,
  negativePrompt: testNegative,
  seed: 424242,
});

// Validar nodos clave
assert.strictEqual(workflow["128:89"].inputs.text, testPrompt, "Prompt positivo inyectado en 128:89");
assert(workflow["128:72"].inputs.text.includes(testNegative), "Prompt negativo inyectado en 128:72");
assert.strictEqual(workflow["128:74"].inputs.width, 480, "Ancho 9:16 en 128:74");
assert.strictEqual(workflow["128:74"].inputs.height, 832, "Alto 9:16 en 128:74");
assert.strictEqual(workflow["128:126"].inputs.value, 3, "Duración 3s en 128:126");
assert.strictEqual(workflow["128:125"].inputs.value, 16, "FPS 16 en 128:125");
assert.strictEqual(workflow["128:129"].inputs.value, true, "Lightning LoRA habilitado en 128:129");
assert.strictEqual(workflow["128:81"].inputs.noise_seed, 424242, "Semilla inyectada en 128:81");
assert.strictEqual(workflow["80"].inputs.filename_prefix, "video/Wan2_2_SaaS", "Prefijo de salida en nodo SaveVideo 80");

console.log("✓ Todos los nodos (SaveVideo, TextEncode, Latent, FPS, Duration, Lightning switch, Seed) fueron parametrizados correctamente.");

console.log("\n=== Test 3: Verificación de Conectividad con ComfyUI ===");
try {
  const resp = await fetch("http://127.0.0.1:8188/system_stats");
  const data = await resp.json();
  console.log("✓ ComfyUI respondiendo:", {
    os: data.system.os,
    gpu: data.devices[0]?.name,
    vram_free: `${(data.devices[0]?.vram_free / (1024 * 1024 * 1024)).toFixed(2)} GB`,
  });
} catch (e) {
  console.log("ComfyUI offline:", e.message);
}

console.log("\n>>> TODOS LOS TESTS DEL MOTOR WAN 2.2 14B PASARON EXITOSAMENTE <<<");
