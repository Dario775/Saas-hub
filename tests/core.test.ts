import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readJson, writeJson, withFileLock } from "../src/lib/json-store";
import { mergeLeadSearch } from "../src/lib/lead-merge";
import { resolvePublicMedia } from "../src/lib/media-path";
import {
  decodeImage,
  validatePlatforms,
  validateScheduleDate,
} from "../src/lib/publish-validation";
import { createSession, validSession } from "../src/lib/auth";
import { fetchPublic, isPublicAddress } from "../src/lib/public-fetch";
import type { LeadItem } from "../src/lib/leads-service";

const lead = (id: string, status: LeadItem["status"] = "nuevo"): LeadItem => ({
  place_id: id,
  nombre: `Comercio ${id}`,
  rubro: "gimnasio",
  zona: "Buenos Aires",
  status,
});

test("repeating a replacement search retains returned businesses and CRM progress", () => {
  const existing = [
    lead("same"),
    { ...lead("customer", "cliente"), notes: "Contrato firmado" },
    lead("old"),
  ];
  const result = mergeLeadSearch(
    existing,
    [lead("same"), lead("new")],
    "replace",
  );
  assert.deepEqual(
    result.map((item) => item.place_id),
    ["same", "new", "customer"],
  );
  assert.equal(result[2].notes, "Contrato firmado");
});
test("accumulation deduplicates results while preserving notes, status and emails", () => {
  const old = {
    ...lead("a", "contactado"),
    notes: "Llamar mañana",
    email: "ventas@example.test",
  };
  const result = mergeLeadSearch(
    [old, lead("b")],
    [lead("a"), lead("a")],
    "accumulate",
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].status, "contactado");
  assert.equal(result[0].email, old.email);
});
test("atomic updates serialize competing writers without losing records", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "hub-store-"));
  const file = path.join(dir, "data.json");
  try {
    writeJson(file, { count: 0 });
    await Promise.all(
      Array.from({ length: 12 }, () =>
        withFileLock(file, async () => {
          const current = readJson(file, { count: 0 });
          await new Promise((resolve) => setTimeout(resolve, 3));
          writeJson(file, { count: current.count + 1 });
        }),
      ),
    );
    assert.equal(readJson(file, { count: 0 }).count, 12);
    writeFileSync(file, "{broken");
    assert.throws(() => readJson(file, []), /recuperación/);
    assert.equal(readFileSync(file, "utf8"), "{broken");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("media paths cannot escape an allowed collection", () => {
  assert.ok(
    resolvePublicMedia("/generated-videos/video.mp4").endsWith(
      path.join("generated-videos", "video.mp4"),
    ),
  );
  for (const value of [
    "/generated-videos/../../.env",
    "/generated-videos/../secret.txt",
    "C:\\secret",
    "https://example.test/video",
    "/.env",
    "generated-videos/..\\secret",
  ])
    assert.throws(() => resolvePublicMedia(value));
});
test("scheduling rejects unsupported channels, past dates and malformed images", () => {
  assert.throws(() => validatePlatforms(["tiktok"]));
  assert.doesNotThrow(() => validatePlatforms(["facebook", "instagram", "linkedin", "x"]));
  assert.throws(() => validateScheduleDate("not-a-date"));
  assert.throws(() => validateScheduleDate("2020-01-01T10:00:00Z"));
  assert.throws(() => decodeImage("data:text/html;base64,SGVsbG8="));
  assert.equal(
    validateScheduleDate("2030-01-01T10:00:00Z", 0),
    "2030-01-01T10:00:00.000Z",
  );
});
test("sessions expire, resist tampering and are invalidated by a changed password", () => {
  const now = Date.now();
  const token = createSession("test-password", now);
  assert.equal(validSession(token, "test-password", now + 1), true);
  assert.equal(validSession(token + "0", "test-password", now + 1), false);
  assert.equal(validSession(token, "changed-password", now + 1), false);
  assert.equal(
    validSession(token, "test-password", now + 13 * 60 * 60_000),
    false,
  );
});
test("public website fetches reject private, encoded and credential-bearing URLs", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "192.168.1.1",
  ])
    assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  for (const url of [
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://user:pass@example.test/",
    "file:///etc/passwd",
  ])
    await assert.rejects(fetchPublic(url));
});
