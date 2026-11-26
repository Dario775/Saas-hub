import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { resolveCategory } from "../src/lib/commercial-taxonomy";
import type { fetchWithRetry } from "../src/lib/fetch-helper";
import { discoverLeads } from "../src/lib/lead-discovery";
import {
  DEFAULT_RADIUS_KM,
  LOCATION_MIN_SCORE,
  OVERPASS_DEFAULT_ENDPOINT,
  OVERPASS_FALLBACK_ENDPOINTS,
  bboxDimensions,
  geocodeArea,
  locationVariants,
  overpassEndpoints,
  queryOverpass,
  radiusBoundingBox,
  scoreLocationResult,
  shouldFailover,
} from "../src/lib/overpass";

/* ------------------------------------------------------------------ */
/* Utilidades: ninguna prueba usa la red                               */
/* ------------------------------------------------------------------ */

type Reply = { status?: number; body?: unknown } | Error;
type ScoredResult = Parameters<typeof scoreLocationResult>[0];

const QUERY = "[out:json];node(1);out;";
const FALLBACK = OVERPASS_FALLBACK_ENDPOINTS[0];
const ELEMENT = { type: "node", id: 1, lat: -24.78, lon: -65.41, tags: { name: "X" } };

const CITY: ScoredResult = {
  display_name: "Salta, Argentina",
  lat: "-24.78",
  lon: "-65.41",
  class: "place",
  type: "city",
  place_rank: 16,
  importance: 0.6,
  boundingbox: ["-24.9", "-24.6", "-65.5", "-65.3"],
};
const STREET: ScoredResult = {
  display_name: "Calle Salta, Rosario",
  lat: "-32.94",
  lon: "-60.65",
  class: "highway",
  type: "residential",
  place_rank: 26,
  importance: 0.1,
  boundingbox: ["-32.941", "-32.940", "-60.651", "-60.650"],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Responde según la URL y registra cada llamada, en orden. */
function fakeRequest(reply: (url: string) => Reply) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    const result = reply(String(url));
    if (result instanceof Error) throw result;
    return json(result.body ?? {}, result.status);
  }) as unknown as typeof fetchWithRetry;
  return { calls, impl };
}

/** Geocodificador simulado: resultados por variante consultada. */
function fakeGeocoder(byVariant: Record<string, Reply>) {
  const queried: string[] = [];
  const { impl } = fakeRequest((url) => {
    const variant = new URL(url).searchParams.get("q") || "";
    queried.push(variant);
    return byVariant[variant] ?? { body: [] };
  });
  return { queried, impl };
}

const previousUrl = process.env.OVERPASS_URL;
beforeEach(() => {
  delete process.env.OVERPASS_URL;
});
afterEach(() => {
  if (previousUrl === undefined) delete process.env.OVERPASS_URL;
  else process.env.OVERPASS_URL = previousUrl;
});

/* ------------------------------------------------------------------ */
/* Puntaje de la zona                                                  */
/* ------------------------------------------------------------------ */

test("una ciudad supera el umbral y una calle no", () => {
  assert.ok(scoreLocationResult(CITY).score >= LOCATION_MIN_SCORE);
  const street = scoreLocationResult(STREET);
  assert.ok(street.score < LOCATION_MIN_SCORE);
  assert.ok(street.reasons.includes("penalizado: vía urbana"));
  // A igualdad de lo demás, ser una calle resta puntaje.
  const neutral = scoreLocationResult({ ...CITY, class: "other", type: "other" });
  const asStreet = scoreLocationResult({ ...CITY, class: "highway", type: "residential" });
  assert.ok(asStreet.score < neutral.score);
});

test("un barrio no alcanza el umbral y un límite administrativo sí", () => {
  const suburb = scoreLocationResult({ ...CITY, type: "suburb" });
  assert.ok(suburb.score < LOCATION_MIN_SCORE);
  assert.ok(suburb.reasons.includes("penalizado: barrio"));
  const boundary = scoreLocationResult({ ...CITY, class: "boundary", type: "administrative" });
  assert.ok(boundary.score >= LOCATION_MIN_SCORE);
});

test("un resultado sin extensión real se penaliza", () => {
  const point = scoreLocationResult({
    ...CITY,
    boundingbox: ["-24.780", "-24.779", "-65.410", "-65.409"],
  });
  assert.ok(point.score < scoreLocationResult(CITY).score);
  assert.ok(point.reasons.includes("penalizado: extensión diminuta (punto)"));
});

/* ------------------------------------------------------------------ */
/* Variantes y geocodificación                                         */
/* ------------------------------------------------------------------ */

test("las variantes van de la más específica a la más general, sin repetir", () => {
  assert.deepEqual(locationVariants(" Tres Cerritos ,Salta,, Argentina"), [
    "Tres Cerritos, Salta, Argentina",
    "Salta, Argentina",
    "Argentina",
  ]);
  assert.deepEqual(locationVariants("Salta, Salta"), ["Salta, Salta", "Salta"]);
  assert.deepEqual(locationVariants("  "), []);
});

test("si la primera variante alcanza, no se consultan más", async () => {
  const geo = fakeGeocoder({ "Salta, Argentina": { body: [CITY] } });
  const result = await geocodeArea("Salta, Argentina", { requestImpl: geo.impl });
  assert.equal(result.ok, true);
  assert.equal(result.area?.queryUsed, "Salta, Argentina");
  assert.deepEqual(geo.queried, ["Salta, Argentina"]);
});

test("pasa a una variante más general si la específica solo encuentra una calle", async () => {
  const geo = fakeGeocoder({
    "Calle Falsa, Salta": { body: [STREET] },
    Salta: { body: [CITY] },
  });
  const result = await geocodeArea("Calle Falsa, Salta", { requestImpl: geo.impl });
  assert.equal(result.area?.displayName, CITY.display_name);
  assert.equal(result.area?.queryUsed, "Salta");
  assert.deepEqual(geo.queried, ["Calle Falsa, Salta", "Salta"]);
  assert.equal(result.considered.length, 2);
});

test("elige la ciudad en cualquier orden, aunque otro resultado sea más extenso", async () => {
  const hugeStreet: ScoredResult = { ...STREET, boundingbox: ["-40", "-20", "-70", "-50"] };
  for (const body of [
    [hugeStreet, CITY],
    [CITY, hugeStreet],
  ]) {
    const geo = fakeGeocoder({ Salta: { body } });
    const result = await geocodeArea("Salta", { requestImpl: geo.impl });
    assert.equal(result.area?.displayName, CITY.display_name);
  }
});

test("rechaza la zona si todo queda por debajo del umbral", async () => {
  const geo = fakeGeocoder({ "Calle Falsa": { body: [STREET] } });
  const result = await geocodeArea("Calle Falsa", { requestImpl: geo.impl });
  assert.equal(result.ok, false);
  assert.equal(result.area, undefined);
  assert.match(result.error || "", /Ninguna variante resolvió una localidad razonable/);
});

test("sin resultados informa que no encontró la zona", async () => {
  const geo = fakeGeocoder({});
  const result = await geocodeArea("Zzz", { requestImpl: geo.impl });
  assert.equal(result.ok, false);
  assert.match(result.error || "", /No se encontró la zona indicada: Zzz/);
});

test("un error de una variante no impide probar la siguiente", async () => {
  const failures: [Reply, RegExp][] = [
    [new Error("sin conexión"), /sin conexión/],
    [{ status: 503 }, /HTTP 503/],
  ];
  for (const [failure, recorded] of failures) {
    const geo = fakeGeocoder({ "Centro, Salta": failure, Salta: { body: [CITY] } });
    const result = await geocodeArea("Centro, Salta", { requestImpl: geo.impl });
    assert.equal(result.ok, true);
    assert.match(result.considered[0], recorded);
  }
});

test("descarta resultados con coordenadas ausentes o inválidas", async () => {
  const geo = fakeGeocoder({
    Salta: {
      body: [
        { ...CITY, boundingbox: undefined },
        { ...CITY, boundingbox: ["x", "-24.6", "-65.5", "-65.3"] },
      ],
    },
  });
  assert.equal((await geocodeArea("Salta", { requestImpl: geo.impl })).ok, false);
});

/* ------------------------------------------------------------------ */
/* Ventana de búsqueda                                                 */
/* ------------------------------------------------------------------ */

test("la ventana mide el doble del radio, centrada, también lejos del ecuador", () => {
  for (const lat of [0, -24.78, -54.8]) {
    const box = radiusBoundingBox({ lat, lon: -65.41 }, 10);
    const { heightKm, widthKm } = bboxDimensions(box);
    assert.ok(Math.abs(heightKm - 20) < 0.2, `alto ${heightKm}`);
    assert.ok(Math.abs(widthKm - 20) < 0.2, `ancho ${widthKm}`);
    assert.ok(Math.abs((box.north + box.south) / 2 - lat) < 1e-9);
    assert.ok(Math.abs((box.east + box.west) / 2 + 65.41) < 1e-9);
  }
});

test("el radio se limita a entre 1 y 25 km", () => {
  const center = { lat: 0, lon: 0 };
  assert.deepEqual(radiusBoundingBox(center, 500), radiusBoundingBox(center, 25));
  assert.deepEqual(radiusBoundingBox(center, 0), radiusBoundingBox(center, 1));
});

/* ------------------------------------------------------------------ */
/* Servidores de respaldo                                              */
/* ------------------------------------------------------------------ */

test("el servidor configurado va primero y no se repite", () => {
  const own = "https://overpass.example/api/interpreter";
  assert.deepEqual(overpassEndpoints(own), [own, OVERPASS_DEFAULT_ENDPOINT, FALLBACK]);
  assert.deepEqual(overpassEndpoints(OVERPASS_DEFAULT_ENDPOINT), [
    OVERPASS_DEFAULT_ENDPOINT,
    FALLBACK,
  ]);
  process.env.OVERPASS_URL = own;
  assert.equal(overpassEndpoints()[0], own);
});

test("solo conviene cambiar de servidor por fallas del servidor o de red", () => {
  for (const status of [undefined, 429, 500, 502, 504])
    assert.equal(shouldFailover(status), true, String(status));
  for (const status of [400, 403, 404]) assert.equal(shouldFailover(status), false, String(status));
});

test("si el primer servidor responde, no se consulta el respaldo", async () => {
  const request = fakeRequest(() => ({ body: { elements: [ELEMENT] } }));
  const result = await queryOverpass(QUERY, { requestImpl: request.impl });
  assert.equal(result.ok, true);
  assert.equal(result.endpoint, OVERPASS_DEFAULT_ENDPOINT);
  assert.deepEqual(request.calls, [OVERPASS_DEFAULT_ENDPOINT]);
});

test("pasa al respaldo si el primero está saturado, caído o no responde", async () => {
  const failures: Reply[] = [
    { status: 429 },
    { status: 504 },
    new Error("ECONNRESET"),
    new DOMException("The operation was aborted due to timeout", "TimeoutError"),
  ];
  for (const failure of failures) {
    const request = fakeRequest((url) =>
      url === FALLBACK ? { body: { elements: [ELEMENT] } } : failure,
    );
    const result = await queryOverpass(QUERY, { requestImpl: request.impl });
    assert.equal(result.ok, true);
    assert.equal(result.endpoint, FALLBACK);
    assert.equal(result.elements.length, 1);
    assert.deepEqual(request.calls, [OVERPASS_DEFAULT_ENDPOINT, FALLBACK]);
    assert.deepEqual(
      result.attempts.map((item) => item.outcome),
      ["failover", "ok"],
    );
  }
});

test("una consulta rechazada no se repite en otro servidor", async () => {
  const request = fakeRequest(() => ({ status: 400 }));
  const result = await queryOverpass(QUERY, { requestImpl: request.impl });
  assert.equal(result.ok, false);
  assert.equal(request.calls.length, 1);
  assert.match(result.error || "", /400/);
});

test("una respuesta válida sin comercios es un éxito y no insiste", async () => {
  const request = fakeRequest(() => ({ body: { elements: [] } }));
  const result = await queryOverpass(QUERY, { requestImpl: request.impl });
  assert.equal(result.ok, true);
  assert.deepEqual(result.elements, []);
  assert.equal(request.calls.length, 1);
});

test("si fallan todos, informa el error y cada intento", async () => {
  const request = fakeRequest(() => ({ status: 503 }));
  const result = await queryOverpass(QUERY, { requestImpl: request.impl });
  assert.equal(result.ok, false);
  assert.equal(result.attempts.length, 2);
  assert.match(result.error || "", /503/);
});

test("sin presupuesto restante no se consulta ningún servidor", async () => {
  const request = fakeRequest(() => ({ body: { elements: [ELEMENT] } }));
  const result = await queryOverpass(QUERY, { requestImpl: request.impl, budgetMs: -1 });
  assert.equal(result.ok, false);
  assert.equal(request.calls.length, 0);
  assert.match(result.error || "", /presupuesto/);
});

/* ------------------------------------------------------------------ */
/* Integración con el descubrimiento                                   */
/* ------------------------------------------------------------------ */

const category = resolveCategory("ferreteria")!;

test("si la zona se rechaza, no se consulta Overpass", async () => {
  const request = fakeRequest((url) => ({
    body: url.includes("nominatim") ? [STREET] : { elements: [ELEMENT] },
  }));
  const result = await discoverLeads({
    location: "Calle Falsa",
    category,
    requestImpl: request.impl,
  });
  assert.deepEqual(result.candidates, []);
  assert.equal(result.errors.length, 1);
  assert.equal(request.calls.length, 1);
  assert.match(request.calls[0], /nominatim/);
});

test("el descubrimiento usa el respaldo, acota el radio y deja constancia", async () => {
  const request = fakeRequest((url) => {
    if (url.includes("nominatim")) return { body: [CITY] };
    return url === FALLBACK ? { body: { elements: [ELEMENT] } } : { status: 504 };
  });
  const run = (radiusKm?: number) =>
    discoverLeads({ location: "Salta", category, radiusKm, requestImpl: request.impl });

  const result = await run(5);
  assert.equal(result.geocode?.radiusKm, 5);
  assert.equal(result.geocode?.displayName, CITY.display_name);
  assert.equal(result.overpass?.endpoint, FALLBACK);
  assert.equal(result.metrics.requestsBySource.overpass, 2);
  assert.deepEqual(result.errors, []);

  // Un radio fuera de los permitidos vuelve al predeterminado.
  assert.equal((await run(7)).geocode?.radiusKm, DEFAULT_RADIUS_KM);
  assert.equal((await run()).geocode?.radiusKm, DEFAULT_RADIUS_KM);
});

/* ------------------------------------------------------------------ */
/* Sin resultados y errores informados con HTTP 200                    */
/* ------------------------------------------------------------------ */

test("sin comercios conserva cómo se resolvió la zona y la ventana buscada", async () => {
  const request = fakeRequest((url) => ({
    body: url.includes("nominatim") ? [CITY] : { elements: [] },
  }));
  const result = await discoverLeads({ location: "Salta", category, requestImpl: request.impl });
  assert.equal(result.geocode?.displayName, CITY.display_name);
  assert.equal(result.overpass?.attempts.length, 1);
  assert.deepEqual(
    result.boundingBox,
    radiusBoundingBox({ lat: -24.78, lon: -65.41 }, DEFAULT_RADIUS_KM),
  );
});

test("un 200 con aviso de tiempo agotado pasa al respaldo", async () => {
  // Overpass puede informar un error de ejecución en `remark` con HTTP 200.
  const request = fakeRequest((url) => ({
    body:
      url === FALLBACK
        ? { elements: [ELEMENT] }
        : { elements: [], remark: "runtime error: Query timed out" },
  }));
  const result = await queryOverpass(QUERY, { requestImpl: request.impl });
  assert.equal(result.endpoint, FALLBACK);
  assert.deepEqual(
    result.attempts.map((item) => item.outcome),
    ["failover", "ok"],
  );
});

test("si todos agotan el tiempo con 200, es un error y no 'sin comercios'", async () => {
  const request = fakeRequest((url) => ({
    body: url.includes("nominatim")
      ? [CITY]
      : { elements: [], remark: "runtime error: Query timed out" },
  }));
  const result = await discoverLeads({ location: "Salta", category, requestImpl: request.impl });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /no completó la consulta.*timed out/);
  assert.equal(result.overpass?.attempts.length, 2);
  assert.equal(result.geocode?.displayName, CITY.display_name);
});

test("un resultado parcial se usa y conserva el aviso", async () => {
  const request = fakeRequest(() => ({
    body: { elements: [ELEMENT], remark: "runtime error: Query timed out" },
  }));
  const result = await queryOverpass(QUERY, { requestImpl: request.impl });
  assert.equal(result.ok, true);
  assert.equal(request.calls.length, 1);
  assert.match(result.attempts[0].error || "", /timed out/);
});

test("un aviso que no es error no cambia un resultado vacío", async () => {
  const request = fakeRequest(() => ({ body: { elements: [], remark: "aviso informativo" } }));
  const result = await queryOverpass(QUERY, { requestImpl: request.impl });
  assert.equal(result.ok, true);
  assert.equal(request.calls.length, 1);
});
