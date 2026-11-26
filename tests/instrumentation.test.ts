import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

type SchedulerGlobal = typeof globalThis & {
  saasScheduler?: ReturnType<typeof setInterval>;
  saasSchedulerBusy?: boolean;
};

test("el único instrumentation es el de src, para que Next no cargue otro en su lugar", () => {
  const root = path.resolve(__dirname, "..");
  for (const extension of ["ts", "tsx", "js", "jsx"])
    assert.equal(existsSync(path.join(root, `instrumentation.${extension}`)), false);
  assert.equal(existsSync(path.join(root, "src", "instrumentation.ts")), true);
});

test("register inicia el programador en el servidor Node", async () => {
  const worker = globalThis as SchedulerGlobal;
  const previousDirectory = process.cwd();
  const previousEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const directory = mkdtempSync(path.join(os.tmpdir(), "hub-instrumentation-"));
  // El programador resuelve su archivo desde cwd al importarse: nunca debe
  // ver la agenda real.
  process.chdir(directory);
  globalThis.fetch = async () => {
    throw new Error("La prueba no debe usar la red.");
  };
  try {
    process.env.NEXT_RUNTIME = "nodejs";
    delete process.env.NEXT_PHASE;
    delete process.env.SCHEDULER_ENABLED;
    const { register } = await import("../src/instrumentation");
    await register();
    assert.ok(worker.saasScheduler);
    while (worker.saasSchedulerBusy)
      await new Promise((resolve) => setTimeout(resolve, 10));
  } finally {
    clearInterval(worker.saasScheduler);
    worker.saasScheduler = undefined;
    globalThis.fetch = originalFetch;
    process.env = previousEnv;
    process.chdir(previousDirectory);
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
});
