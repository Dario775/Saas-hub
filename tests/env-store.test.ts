import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { saveEnvironment } from "../src/lib/env-store";

test("settings writers preserve other keys and reject injected environment lines", async () => {
  const originalDirectory = process.cwd();
  const directory = mkdtempSync(path.join(os.tmpdir(), "hub-settings-test-"));
  const keys = ["HUB_TEST_PROVIDER_A", "HUB_TEST_PROVIDER_B"];
  const previous = keys.map(key => process.env[key]);
  try {
    process.chdir(directory);
    writeFileSync(".env.local", "EXISTING_CONFIGURATION=keep\n");
    await Promise.all([
      saveEnvironment({ HUB_TEST_PROVIDER_A: "example-one" }),
      saveEnvironment({ HUB_TEST_PROVIDER_B: "example-two-$&" }),
    ]);
    const content = readFileSync(".env.local", "utf8");
    assert.match(content, /EXISTING_CONFIGURATION=keep/);
    assert.match(content, /HUB_TEST_PROVIDER_A="example-one"/);
    assert.ok(content.includes('HUB_TEST_PROVIDER_B="example-two-$&"'));
    await assert.rejects(saveEnvironment({ HUB_TEST_PROVIDER_A: "bad\nOTHER_KEY=injected" }));
    assert.equal(readFileSync(".env.local", "utf8"), content);
    assert.equal(process.env.HUB_TEST_PROVIDER_A, "example-one");
  } finally {
    process.chdir(originalDirectory);
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
