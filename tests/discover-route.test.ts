import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { NextRequest } from "next/server";

const originalFetch = globalThis.fetch;
const previousDirectory = process.cwd();
const previousUrl = process.env.OVERPASS_URL;
// Los prospectos se resuelven desde cwd al importar: nunca los datos reales.
const directory = mkdtempSync(path.join(os.tmpdir(), "hub-discover-"));
let POST: typeof import("../src/app/api/leads/discover/route").POST;
let calls: string[] = [];

before(async () => {
  process.chdir(directory);
  delete process.env.OVERPASS_URL;
  ({ POST } = await import("../src/app/api/leads/discover/route"));
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("nominatim"))
      return Response.json([
        {
          display_name: "Salta, Argentina",
          lat: "-24.78",
          lon: "-65.41",
          class: "place",
          type: "city",
          boundingbox: ["-24.9", "-24.6", "-65.5", "-65.3"],
        },
      ]);
    return Response.json({
      elements: [
        { type: "node", id: 1, lat: -24.78, lon: -65.41, tags: { name: "Ferretería Prueba", shop: "hardware" } },
      ],
    });
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
  if (previousUrl !== undefined) process.env.OVERPASS_URL = previousUrl;
  process.chdir(previousDirectory);
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
  } catch {
    // Ignorar bloqueo transitorio de temp en Windows
  }
});

async function preview(extra: Record<string, unknown>) {
  calls = [];
  const response = await POST(
    new NextRequest("http://localhost/api/leads/discover", {
      method: "POST",
      body: JSON.stringify({ action: "preview", location: "Salta", category: "ferreteria", ...extra }),
    }),
  );
  return { status: response.status, data: await response.json() };
}

test("la vista previa usa el radio pedido y devuelve el detalle", async () => {
  const { status, data } = await preview({ radiusKm: 5 });
  assert.equal(status, 200);
  assert.equal(data.geocode.radiusKm, 5);
  assert.equal(data.geocode.displayName, "Salta, Argentina");
  assert.equal(data.overpass.attempts.length, 1);
  assert.equal(data.candidates.length, 1);
});

test("sin radio se usa el predeterminado", async () => {
  const { data } = await preview({});
  assert.equal(data.geocode.radiusKm, 10);
});

test("un radio no permitido se rechaza sin consultar servicios", async () => {
  for (const radiusKm of [7, 500, "10", null]) {
    const { status, data } = await preview({ radiusKm });
    assert.equal(status, 400, String(radiusKm));
    assert.match(data.error, /5, 10, 20, 25/);
    assert.equal(calls.length, 0);
  }
});
