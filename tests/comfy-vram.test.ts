import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { prepareVram } from "../src/lib/comfy-vram";

const COMFY = "http://127.0.0.1:8188";
const OLLAMA = "http://127.0.0.1:11434";
const globals = globalThis as typeof globalThis & { saasComfyWorkload?: string };

beforeEach(() => {
  globals.saasComfyWorkload = undefined;
});

function fakeFetch(options: { models?: string[]; free?: number[]; comfyDown?: boolean } = {}) {
  const calls: { url: string; body?: unknown }[] = [];
  const free = [...(options.free || [0.95])];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (String(url).startsWith(COMFY) && options.comfyDown) throw new Error("ECONNREFUSED");
    if (String(url).endsWith("/api/ps"))
      return Response.json({ models: (options.models || []).map((name) => ({ name })) });
    if (String(url).endsWith("/system_stats")) {
      const ratio = free.length > 1 ? free.shift()! : free[0];
      return Response.json({ devices: [{ vram_total: 100, vram_free: ratio * 100 }] });
    }
    return Response.json({});
  }) as typeof fetch;
  const run = (workload: string, ollamaUrl = OLLAMA) =>
    prepareVram(workload, { comfyUrl: COMFY, ollamaUrl, fetchImpl: impl, pollIntervalMs: 0 });
  return { calls, run, posted: (suffix: string) => calls.filter((call) => call.url.endsWith(suffix)) };
}

test("libera los modelos al cambiar de generador y no al repetir el mismo", async () => {
  const fake = fakeFetch();
  assert.equal((await fake.run("z-image-turbo")).freed, true);
  assert.equal((await fake.run("z-image-turbo")).freed, false);
  assert.equal((await fake.run("qwen-image-2.1")).freed, true);
  assert.equal(fake.posted("/free").length, 2);
  assert.deepEqual(fake.posted("/free")[0].body, { unload_models: true, free_memory: true });
});

test("espera a que la memoria se libere antes de seguir", async () => {
  const fake = fakeFetch({ free: [0.1, 0.4, 0.9] });
  const report = await fake.run("video");
  assert.equal(report.freeRatio, 0.9);
  assert.equal(fake.posted("/system_stats").length, 3);
});

test("no espera para siempre si la memoria no baja", async () => {
  const fake = fakeFetch({ free: [0.2] });
  const report = await fake.run("video");
  assert.equal(report.freed, true);
  assert.ok(fake.posted("/system_stats").length <= 12);
});

test("descarga los modelos que Ollama dejó cargados", async () => {
  const fake = fakeFetch({ models: ["llama3", "qwen"] });
  assert.deepEqual((await fake.run("z-image-turbo")).unloadedLlms, ["llama3", "qwen"]);
  assert.deepEqual(fake.posted("/api/generate").map((call) => call.body), [
    { model: "llama3", keep_alive: 0 },
    { model: "qwen", keep_alive: 0 },
  ]);
});

test("no toca un Ollama de otro equipo", async () => {
  const fake = fakeFetch({ models: ["llama3"] });
  await fake.run("z-image-turbo", "http://192.168.0.20:11434");
  assert.ok(fake.calls.every((call) => !call.url.includes("192.168")));
});

test("si ComfyUI no responde, no rompe y vuelve a intentar la próxima vez", async () => {
  const down = fakeFetch({ comfyDown: true });
  assert.equal((await down.run("z-image-turbo")).freed, false);
  assert.equal((await fakeFetch().run("z-image-turbo")).freed, true);
});
