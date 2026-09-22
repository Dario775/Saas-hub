import test from "node:test";
import assert from "node:assert/strict";

import {
  identityStatusToEvidence,
  matchBusinessIdentity,
  normalizePhoneDigits,
} from "../src/lib/identity-match";
import {
  DISCOVERY_TTL_MS,
  discoverBusinessPresence,
  officialSiteCandidate,
} from "../src/lib/business-discovery";
import type { DiscoveryLeadLike } from "../src/lib/business-discovery";
import {
  DEFAULT_EVALUATED_FIELDS,
  evidenceCoverage,
  fieldStatus,
  makeEvidence,
  supportedValues,
} from "../src/lib/lead-evidence";
import type { LeadEvidence } from "../src/lib/lead-evidence";
import {
  detectCommerceSignals,
  enrichLead,
  extractDescription,
  extractPhones,
  extractStructuredDataTypes,
  extractTitle,
} from "../src/lib/lead-enrichment";
import { askJev, buildOpportunitySignals } from "../src/lib/jev";
import { analyzeWithDeepSeek } from "../src/lib/opportunity-analysis";
import { buildDiscoveryQueries, resolveWebSearchProvider, searchWeb } from "../src/lib/web-search";
import type { WebSearchProvider } from "../src/lib/web-search";

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

// Clave ficticia: permite ejercitar la ruta de Google Places con la red simulada.
process.env.GOOGLE_PLACES_KEY = "test-google-places-key";

const lead = (over: Partial<DiscoveryLeadLike> = {}): DiscoveryLeadLike => ({
  place_id: "osm:node/1",
  nombre: "Volkswagen Repuestos",
  rubro: "autopartes",
  zona: "Salta Capital, Salta",
  direccion: "Tucumán 266, Salta",
  ...over,
});

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function patchFetch(handler: (url: string) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    return handler(url);
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

const PAGE_HTML = `<!doctype html><html><head>
<title>Volkswagen Repuestos Salta</title>
<meta name="description" content="Repuestos originales Volkswagen en Salta">
<script type="application/ld+json">{"@type":"Store","name":"Volkswagen Repuestos"}</script>
<script type="application/ld+json">{"@type":"Product","name":"Filtro"}</script>
</head><body>
<a href="mailto:ventas@vwrepuestos.com.ar">Mail</a>
<a href="tel:+543874000000">Llamar</a>
<a href="https://instagram.com/vwrepuestos">IG</a>
<a href="https://www.facebook.com/vwrepuestos">FB</a>
<a href="https://wa.me/5493874000000">WhatsApp</a>
<a href="https://www.tiktok.com/@vwrepuestos">TikTok</a>
<p>Carrito de compras y catálogo de productos</p>
<form action="/contacto"><input name="consulta"></form>
</body></html>`;

const NEW_PLACES_RESPONSE = {
  places: [
    {
      id: "ChIJvwtest",
      displayName: { text: "Volkswagen Repuestos" },
      formattedAddress: "Tucumán 266, Salta",
      internationalPhoneNumber: "+54 387 400-0000",
      websiteUri: "https://vwrepuestos.com.ar",
      rating: 4.6,
      userRatingCount: 87,
      businessStatus: "OPERATIONAL",
      primaryType: "auto_parts_store",
      types: ["auto_parts_store", "store"],
      googleMapsUri: "https://maps.google.com/?cid=vwtest",
      location: { latitude: -24.7883, longitude: -65.4106 },
    },
  ],
};

function webfetchStub(html: string, finalUrl?: string) {
  return async () => ({ body: Buffer.from(html, "utf8"), contentType: "text/html", finalUrl });
}

/* ------------------------------------------------------------------ */
/* Correlación de identidad (determinista, por reglas)                 */
/* ------------------------------------------------------------------ */

test("identidad: coincide cuando nombre, teléfono y dominio apuntan al mismo negocio", () => {
  const result = matchBusinessIdentity(
    { nombre: "Volkswagen Repuestos", zona: "Salta", telefono: "+54 387 400-0000", website: "https://vwrepuestos.com.ar" },
    {
      nombre: "Volkswagen Repuestos",
      direccion: "Tucumán 266, Salta",
      telefono: "0387 4000000",
      website: "https://www.vwrepuestos.com.ar/",
    },
  );
  assert.equal(result.status, "matched");
  assert.ok(result.confidence >= 0.75);
  assert.ok(result.matchedSignals.includes("teléfono coincidente"));
  assert.ok(result.matchedSignals.includes("mismo dominio web"));
  assert.equal(identityStatusToEvidence(result.status), "verified");
});

test("identidad: probable cuando comparte nombre y ciudad pero falta contacto", () => {
  const result = matchBusinessIdentity(
    { nombre: "Volkswagen Repuestos", zona: "Salta Capital", rubro: "autopartes" },
    { nombre: "Volkswagen Repuestos Salta", direccion: "Av. Belgrano 100, Salta", rubro: "autopartes" },
  );
  assert.equal(result.status, "probable");
  assert.equal(identityStatusToEvidence(result.status), "found");
});

test("identidad: ambigua cuando solo hay un parecido débil", () => {
  const result = matchBusinessIdentity(
    { nombre: "Repuestos Norte", zona: "Salta" },
    { nombre: "Repuestos Norte Sur", direccion: "Otra ciudad" },
  );
  assert.equal(result.status, "ambiguous");
  assert.equal(identityStatusToEvidence(result.status), "conflicting");
});

test("identidad: rechazada por distancia y por nombre no relacionado", () => {
  const far = matchBusinessIdentity(
    { nombre: "Volkswagen Repuestos", lat: "-24.78", lon: "-65.41" },
    { nombre: "Volkswagen Repuestos", lat: "-26.82", lon: "-65.21" },
  );
  assert.equal(far.status, "rejected");
  assert.ok(far.conflictingSignals.some((signal) => signal.includes("5 km")));

  const unrelated = matchBusinessIdentity(
    { nombre: "Ferretería El Progreso", zona: "Salta" },
    { nombre: "Gimnasio Iron", direccion: "Salta" },
  );
  assert.equal(unrelated.status, "rejected");
  assert.equal(identityStatusToEvidence(unrelated.status), "not_found");
});

test("los teléfonos se normalizan antes de comparar", () => {
  assert.equal(normalizePhoneDigits("+54 9 387 400-0000"), "3874000000");
  assert.equal(normalizePhoneDigits("0387 400 0000"), "3874000000");
});

/* ------------------------------------------------------------------ */
/* Google Places                                                       */
/* ------------------------------------------------------------------ */

test("Google Places aporta evidencia con su fuente y sin inventar rating", async () => {
  const patched = patchFetch(() => jsonResponse(NEW_PLACES_RESPONSE));
  try {
    const result = await discoverBusinessPresence(lead({ telefono: "+54 387 400-0000" }), {
      skipWebSearch: true,
      skipWebsite: true,
    });
    const dossier = result.dossier;
    assert.equal(dossier.google?.rating, 4.6);
    assert.equal(dossier.google?.ratingCount, 87);
    assert.equal(dossier.google?.businessStatus, "OPERATIONAL");
    assert.equal(dossier.identity?.status, "matched");
    assert.equal(fieldStatus(result.evidence, "identity"), "verified");
    const rating = result.evidence.find((item) => item.field === "rating" && item.status === "found");
    assert.ok(rating);
    assert.equal(rating?.source, "google_places");
    assert.equal(result.summary.sourcesSucceeded.includes("google_places"), true);
    assert.equal(patched.calls[0], "https://places.googleapis.com/v1/places:searchText");
  } finally {
    patched.restore();
  }
});

test("si hay varios candidatos plausibles no se fusiona nada", async () => {
  const patched = patchFetch(() =>
    jsonResponse({
      places: [
        NEW_PLACES_RESPONSE.places[0],
        {
          ...NEW_PLACES_RESPONSE.places[0],
          id: "ChIJotro",
          websiteUri: "https://otro-vw.com.ar",
          internationalPhoneNumber: "+54 387 411-1111",
        },
      ],
    }),
  );
  try {
    const result = await discoverBusinessPresence(lead(), { skipWebSearch: true, skipWebsite: true });
    assert.equal(result.dossier.identity?.status, "ambiguous");
    assert.equal(fieldStatus(result.evidence, "identity"), "conflicting");
    assert.ok(result.summary.conflicts.length > 0);
    // No se fusionó el sitio ni el teléfono de ningún candidato.
    assert.equal(supportedValues(result.evidence, "phone").length, 0);
    assert.equal(supportedValues(result.evidence, "website").length, 0);
  } finally {
    patched.restore();
  }
});

test("una fuente que falla no rompe el descubrimiento", async () => {
  const patched = patchFetch(() => new Response("boom", { status: 500 }));
  try {
    const result = await discoverBusinessPresence(lead(), { skipWebSearch: true, skipWebsite: true });
    assert.ok(result.summary.sourcesFailed.some((item) => item.source === "google_places"));
    assert.ok(result.dossier.generatedAt);
    assert.equal(result.dossier.coverage.total, DEFAULT_EVALUATED_FIELDS.length);
  } finally {
    patched.restore();
  }
});

/* ------------------------------------------------------------------ */
/* Sitio web                                                           */
/* ------------------------------------------------------------------ */

test("el sitio accesible aporta título, descripción, contactos y formulario", async () => {
  const result = await enrichLead(
    lead({ website: "vwrepuestos.com.ar" }),
    undefined,
    { fetchImpl: webfetchStub(PAGE_HTML, "https://vwrepuestos.com.ar/"), pauseMs: 0 },
  );
  assert.equal(result.website.reachable, true);
  assert.equal(result.website.finalUrl, "https://vwrepuestos.com.ar/");
  assert.equal(result.website.title, "Volkswagen Repuestos Salta");
  assert.match(result.website.description || "", /Repuestos originales/);
  assert.equal(fieldStatus(result.evidence, "website"), "verified");
  assert.equal(fieldStatus(result.evidence, "email"), "found");
  assert.equal(fieldStatus(result.evidence, "whatsapp"), "found");
  assert.equal(fieldStatus(result.evidence, "contact_form"), "found");
  assert.ok(result.findings.phones.length > 0);
  assert.ok(result.findings.structuredDataTypes.includes("Product"));
});

test("una redirección se registra con la URL final", async () => {
  const result = await enrichLead(lead({ website: "http://vwrepuestos.com.ar" }), undefined, {
    fetchImpl: webfetchStub("<html><title>Redirigido</title></html>", "https://www.vwrepuestos.com.ar/inicio"),
    pauseMs: 0,
  });
  assert.equal(result.website.finalUrl, "https://www.vwrepuestos.com.ar/inicio");
});

test("si el sitio no responde queda desconocido, sin afirmar nada", async () => {
  const result = await enrichLead(lead({ website: "caido.test" }), undefined, {
    fetchImpl: async () => {
      throw new Error("El sitio tardó demasiado en responder.");
    },
    pauseMs: 0,
  });
  assert.equal(fieldStatus(result.evidence, "website"), "unknown");
  assert.equal(result.website.reachable, false);
  assert.ok(result.errors.length > 0);
});

test("extractores: teléfonos, título, descripción y datos estructurados", () => {
  assert.deepEqual(extractPhones(PAGE_HTML), ["+543874000000"]);
  assert.equal(extractTitle(PAGE_HTML), "Volkswagen Repuestos Salta");
  assert.match(extractDescription(PAGE_HTML) || "", /Salta/);
  assert.deepEqual(extractStructuredDataTypes(PAGE_HTML), ["Store", "Product"]);
  const commerce = detectCommerceSignals(PAGE_HTML);
  assert.equal(commerce.ecommerce, true);
  assert.equal(commerce.catalog, true);
  assert.equal(commerce.contactForm, true);
});

/* ------------------------------------------------------------------ */
/* No buscado vs no encontrado · cobertura                             */
/* ------------------------------------------------------------------ */

test("sin fuentes se distingue no buscado de no encontrado", async () => {
  const skipped = await discoverBusinessPresence(lead(), {
    skipGoogle: true,
    skipWebsite: true,
    skipWebSearch: true,
  });
  assert.equal(fieldStatus(skipped.evidence, "website"), "not_searched");
  assert.equal(skipped.summary.coverageAfter.notSearched > 0, true);

  const patched = patchFetch(() => jsonResponse({ places: [] }));
  try {
    const consulted = await discoverBusinessPresence(lead(), { skipWebsite: true, skipWebSearch: true });
    assert.equal(fieldStatus(consulted.evidence, "website"), "not_found");
    const note = consulted.evidence.find((item) => item.field === "website")?.notes || "";
    assert.match(note, /No se encontró sitio web en las fuentes consultadas/i);
    assert.doesNotMatch(note, /no tiene/i);
  } finally {
    patched.restore();
  }
});

test("la cobertura sube cuando hay datos públicos y no cuenta inferencias", async () => {
  const before = evidenceCoverage(
    [makeEvidence({ field: "address", status: "found", value: "Tucumán 266", source: "openstreetmap" })],
    DEFAULT_EVALUATED_FIELDS,
  );
  const patched = patchFetch(() => jsonResponse(NEW_PLACES_RESPONSE));
  try {
    const result = await discoverBusinessPresence(
      lead({
        evidence: [
          makeEvidence({
            field: "address",
            status: "found",
            value: "Tucumán 266, Salta",
            source: "openstreetmap",
          }),
        ],
      }),
      {
        skipWebSearch: true,
        fetchImpl: webfetchStub(PAGE_HTML),
      },
    );
    assert.equal(result.summary.coverageBefore.supported, before.supported);
    assert.ok(result.summary.coverageAfter.supported > result.summary.coverageBefore.supported);
    // El ecommerce detectado en el sitio es inferido: no suma cobertura.
    assert.equal(fieldStatus(result.evidence, "ecommerce"), "inferred");
    assert.ok(result.summary.coverageAfter.inferred >= 1);
    assert.ok(result.summary.coverageAfter.score > result.summary.coverageBefore.score);
  } finally {
    patched.restore();
  }
});

/* ------------------------------------------------------------------ */
/* Caché                                                               */
/* ------------------------------------------------------------------ */

test("la caché reutiliza el dossier y respeta el TTL", async () => {
  const patched = patchFetch(() => jsonResponse(NEW_PLACES_RESPONSE));
  try {
    const first = await discoverBusinessPresence(lead(), { skipWebSearch: true, skipWebsite: true });
    const callsAfterFirst = patched.calls.length;

    const cached: DiscoveryLeadLike = { ...lead(), dossier: first.dossier };
    const hit = await discoverBusinessPresence(cached, { skipWebSearch: true, skipWebsite: true });
    assert.equal(hit.cacheHit, true);
    assert.equal(patched.calls.length, callsAfterFirst);
    assert.equal(hit.summary.sourcesSucceeded[0], "cache");
    assert.equal(hit.evidence.length, first.evidence.length);

    // Vencido: se vuelve a consultar.
    const stale: DiscoveryLeadLike = {
      ...lead(),
      dossier: { ...first.dossier, generatedAt: new Date(Date.now() - DISCOVERY_TTL_MS - 1000).toISOString() },
    };
    const refreshed = await discoverBusinessPresence(stale, { skipWebSearch: true, skipWebsite: true });
    assert.equal(refreshed.cacheHit, false);
    assert.ok(patched.calls.length > callsAfterFirst);

    // forceRefresh ignora la caché fresca.
    const forced = await discoverBusinessPresence(cached, {
      skipWebSearch: true,
      skipWebsite: true,
      forceRefresh: true,
    });
    assert.equal(forced.cacheHit, false);
  } finally {
    patched.restore();
  }
});

/* ------------------------------------------------------------------ */
/* Búsqueda web (opcional) y candidato a sitio oficial                 */
/* ------------------------------------------------------------------ */

test("sin proveedor configurado la búsqueda web queda deshabilitada con motivo claro", async () => {
  assert.equal(resolveWebSearchProvider({} as NodeJS.ProcessEnv), null);
  const outcome = await searchWeb("volkswagen salta", { provider: null });
  assert.equal(outcome.ok, false);
  assert.match(outcome.error || "", /SEARXNG_URL/);
});

test("el candidato a sitio oficial exige que el dominio se parezca al nombre", () => {
  const items = [
    { title: "Otra cosa", url: "https://mercadolibre.com.ar/vw" },
    { title: "Sitio", url: "https://vwrepuestos.com.ar/inicio" },
  ];
  assert.equal(officialSiteCandidate("Volkswagen Repuestos", items)?.url, "https://vwrepuestos.com.ar/inicio");
  assert.equal(officialSiteCandidate("Ferretería Norte", items), undefined);
});

test("con proveedor, la búsqueda web aporta perfiles públicos sin afirmar actividad", async () => {
  const provider: WebSearchProvider = {
    id: "test",
    label: "Test",
    requiresKey: false,
    async search() {
      return {
        ok: true,
        provider: "test",
        items: [
          { title: "Volkswagen Repuestos Salta", url: "https://instagram.com/volkswagenrepuestos" },
          { title: "Volkswagen Repuestos Salta", url: "https://www.facebook.com/volkswagenrepuestos" },
        ],
      };
    },
  };
  const patched = patchFetch(() => jsonResponse({ places: [] }));
  try {
    const result = await discoverBusinessPresence(lead(), {
      skipWebsite: true,
      webSearchProvider: provider,
    });
    assert.ok(result.dossier.social.instagram.length > 0);
    assert.equal(result.summary.sourcesSucceeded.includes("web_search"), true);
    const item = result.evidence.find((entry) => entry.source === "web_search");
    assert.match(item?.notes || "", /No se verificó actividad/);
  } finally {
    patched.restore();
  }
});

/* ------------------------------------------------------------------ */
/* El dossier llega a los dos motores                                  */
/* ------------------------------------------------------------------ */

test("el dossier viaja en el estado que recibe Jev", async () => {
  // 1) Descubrimiento con Google Places simulado.
  const control = lead({ telefono: "+54 387 400-0000" });
  const places = patchFetch(() => jsonResponse(NEW_PLACES_RESPONSE));
  let dossier;
  try {
    const discovery = await discoverBusinessPresence(control, {
      skipWebSearch: true,
      skipWebsite: true,
    });
    dossier = discovery.dossier;
  } finally {
    places.restore();
  }

  // 2) Llamada a Jev capturando el cuerpo enviado.
  const original = globalThis.fetch;
  let captured: Record<string, unknown> = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured =
      typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    return jsonResponse({
      model: "jev-test",
      answers: {
        worth_deep_analysis: { type: "choice", choice: "yes", confidence: 0.9, probabilities: {} },
        business_verifiable: { type: "noul", noul: 0.9 },
      },
    });
  }) as typeof fetch;

  try {
    const signals = buildOpportunitySignals(control, [], dossier);
    assert.equal(signals.version, "signals-v2");
    assert.equal(signals.identityStatus, "matched");
    await askJev(signals, [], { apiKey: "jv_live_prueba", dossier });
    const state = captured.state as Record<string, unknown>;
    assert.ok(state.dossier);
    const sent = state.dossier as Record<string, unknown>;
    assert.ok(sent.identity);
    assert.equal((sent.coverage as Record<string, unknown>).total, DEFAULT_EVALUATED_FIELDS.length);
  } finally {
    globalThis.fetch = original;
  }
});

test("el dossier viaja también al prompt de DeepSeek", async () => {
  const original = globalThis.fetch;
  let userPrompt = "";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const messages = (body.messages || []) as { role: string; content: string }[];
    userPrompt = messages.find((message) => message.role === "user")?.content || "";
    return jsonResponse({
      choices: [{ message: { content: JSON.stringify({ opportunityDetected: false, evidenceUsed: [], recommendedProducts: [], reasoning: "sin datos" }) } }],
    });
  }) as typeof fetch;

  try {
    const evidence: LeadEvidence[] = [
      makeEvidence({ field: "website", status: "not_found", source: "derived" }),
    ];
    const analysis = await analyzeWithDeepSeek(
      {
        lead: lead(),
        evidence,
        dossier: {
          leadId: "osm:node/1",
          business: { name: "Volkswagen Repuestos", category: "autopartes", address: "Tucumán 266" },
          website: { status: "not_found", checkedUrls: [] },
          contacts: { phones: ["3874000000"], whatsapp: [], emails: [], contactForms: [] },
          social: { instagram: ["https://instagram.com/vwrepuestos"], facebook: [], tiktok: [], linkedin: [], youtube: [] },
          commerce: { ecommerce: "inferred", catalog: "inferred", markers: ["carrito"] },
          evidence,
          sourcesConsulted: ["google_places"],
          sourcesUnavailable: [],
          coverage: evidenceCoverage(evidence, DEFAULT_EVALUATED_FIELDS),
          generatedAt: new Date().toISOString(),
          ttlMs: DISCOVERY_TTL_MS,
        },
      },
      { settings: { provider: "deepseek", deepseekApiKey: "test" } },
    );
    assert.equal(analysis.ok, true);
    assert.match(userPrompt, /DOSSIER DIGITAL/);
    assert.match(userPrompt, /instagram\.com\/vwrepuestos/);
    assert.equal(analysis.evidenceCoverage.total, DEFAULT_EVALUATED_FIELDS.length);
  } finally {
    globalThis.fetch = original;
  }
});

/* ------------------------------------------------------------------ */
/* Fase 3.1: búsqueda web correlacionada y fuentes opcionales          */
/* ------------------------------------------------------------------ */

function providerWith(items: { title: string; url: string; snippet?: string }[]): WebSearchProvider {
  return {
    id: "test",
    label: "Test",
    requiresKey: false,
    async search() {
      return { ok: true, provider: "test", items };
    },
  };
}

test("el planificador arma pocas consultas orientadas a identidad", () => {
  const queries = buildDiscoveryQueries({
    nombre: "Volkswagen Repuestos",
    zona: "Salta Capital, Salta",
    direccion: "Tucumán 266, Salta",
  });
  assert.equal(queries.length, 4);
  assert.ok(queries[0].query.startsWith('"Volkswagen Repuestos"'));
  assert.ok(queries[0].query.includes("Salta"));
  assert.ok(queries.some((item) => item.intent === "instagram"));
  assert.ok(queries.some((item) => item.intent === "identidad_direccion"));
  assert.deepEqual(buildDiscoveryQueries({}), []);
});

test("un resultado de búsqueda sin señales de identidad se rechaza y no es evidencia", async () => {
  const patched = patchFetch(() => jsonResponse({ places: [] }));
  try {
    const result = await discoverBusinessPresence(lead(), {
      skipWebsite: true,
      webSearchProvider: providerWith([
        {
          title: "Repuestera San Martin",
          url: "https://www.facebook.com/repuestera.san.martin/",
          snippet: "Repuestos para autos en San Martin",
        },
      ]),
    });
    assert.equal(supportedValues(result.evidence, "facebook").length, 0);
    assert.equal(result.summary.searchResults?.rejected, 1);
    assert.equal(result.summary.searchResults?.accepted, 0);
    assert.equal(result.dossier.social.facebook.length, 0);
  } finally {
    patched.restore();
  }
});

test("un perfil social correlacionado se registra sin afirmar actividad", async () => {
  const patched = patchFetch(() => jsonResponse({ places: [] }));
  try {
    const result = await discoverBusinessPresence(lead(), {
      skipWebsite: true,
      webSearchProvider: providerWith([
        {
          title: "Volkswagen Repuestos Salta",
          url: "https://www.facebook.com/volkswagen.repuestos.salta/",
          snippet: "Volkswagen Repuestos, Salta Capital",
        },
      ]),
    });
    const facebook = supportedValues(result.evidence, "facebook");
    assert.equal(facebook.length, 1);
    assert.equal(result.summary.searchResults?.accepted, 1);
    const item = result.evidence.find((entry) => entry.field === "facebook");
    assert.match(item?.notes || "", /No se verificó actividad/);
    assert.match(item?.notes || "", /Correlación/);
  } finally {
    patched.restore();
  }
});

test("un perfil con handle parecido pero ajeno se rechaza", async () => {
  const patched = patchFetch(() => jsonResponse({ places: [] }));
  try {
    const result = await discoverBusinessPresence(lead(), {
      skipWebsite: true,
      webSearchProvider: providerWith([
        {
          title: "Volkswagen Repuestos Salta - Repuestos VW",
          url: "https://www.instagram.com/hausrepuestosvw/",
          snippet: "Repuestos Volkswagen en Salta",
        },
      ]),
    });
    assert.equal(supportedValues(result.evidence, "instagram").length, 0);
    assert.equal(result.summary.searchResults?.rejected, 1);
  } finally {
    patched.restore();
  }
});

test("un directorio correlacionado no se toma como sitio oficial", async () => {
  const patched = patchFetch(() => jsonResponse({ places: [] }));
  try {
    const result = await discoverBusinessPresence(lead(), {
      skipWebsite: true,
      webSearchProvider: providerWith([
        {
          title: "Volkswagen Repuestos en Salta - Páginas Amarillas",
          url: "https://www.paginasamarillas.com.ar/b/volkswagen-repuestos/salta",
          snippet: "Volkswagen Repuestos, Tucumán 266, Salta. Tel: 0387 421-0000",
        },
      ]),
    });
    assert.equal(supportedValues(result.evidence, "website").length, 0);
    const phone = supportedValues(result.evidence, "phone");
    assert.equal(phone.length, 1);
    const item = result.evidence.find((entry) => entry.field === "phone");
    assert.equal(item?.source, "web_search");
    assert.match(item?.notes || "", /directorio/i);
  } finally {
    patched.restore();
  }
});

test("Google Places ausente es una fuente opcional: no es fallo ni afecta la cobertura", async () => {
  const previous = process.env.GOOGLE_PLACES_KEY;
  delete process.env.GOOGLE_PLACES_KEY;
  const patched = patchFetch(() => {
    throw new Error("no debería llamarse a la red");
  });
  try {
    const result = await discoverBusinessPresence(lead(), { skipWebSearch: true, skipWebsite: true });
    assert.equal(result.summary.sourcesFailed.length, 0);
    assert.ok(
      (result.summary.sourcesSkipped || []).some((item) => item.source === "google_places"),
    );
    assert.equal(result.summary.sourcesSucceeded.length, 0);
    assert.equal(result.summary.coverageAfter.total, DEFAULT_EVALUATED_FIELDS.length);
    assert.equal(result.summary.coverageAfter.supported, 2);
    assert.equal(patched.calls.length, 0);
  } finally {
    patched.restore();
    if (previous !== undefined) process.env.GOOGLE_PLACES_KEY = previous;
  }
});
