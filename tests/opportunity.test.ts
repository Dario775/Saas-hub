import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { leadIdentity, normalizeIdentityText, osmPlaceId } from "../src/lib/lead-identity";
import {
  describeFieldStatus,
  evidenceCoverage,
  fieldStatus,
  hasSupportedValue,
  makeEvidence,
  mergeEvidence,
} from "../src/lib/lead-evidence";
import type { LeadEvidence } from "../src/lib/lead-evidence";
import { mergeLeadSearch } from "../src/lib/lead-merge";
import {
  buildOpportunitySignals,
  buildQuestions,
  JEV_CONFIDENCE_THRESHOLD,
  askJev,
  mapJevUsage,
  resolveJevConfig,
  resolveJevEndpoint,
  routeJevDecision,
} from "../src/lib/jev";
import {
  detectCommerceSignals,
  enrichLead,
  extractEmails,
  extractSocialLinks,
  normalizeWebsiteUrl,
} from "../src/lib/lead-enrichment";
import { analyzeWithDeepSeek, normalizeAnalysisJson } from "../src/lib/opportunity-analysis";
import {
  analyzeOpportunity,
  isAnalysisInFlight,
} from "../src/lib/opportunity-pipeline";
import type { OpportunityLeadStore } from "../src/lib/opportunity-pipeline";
import { appendOpportunityLog, readOpportunityLog } from "../src/lib/opportunity-log";
import type { LeadItem } from "../src/lib/leads-service";

/* ------------------------------------------------------------------ */
/* Utilidades de prueba                                                */
/* ------------------------------------------------------------------ */

const lead = (over: Partial<LeadItem> = {}): LeadItem => ({
  place_id: "osm:node/1",
  nombre: "Ferretería El Progreso",
  rubro: "ferretería",
  zona: "Salta Capital, Salta",
  status: "nuevo",
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

const jevAnswer = (
  choice: "yes" | "no",
  confidence: number,
  businessVerifiable = 0.97,
) => ({
  model: "jev-test-1",
  answers: {
    worth_deep_analysis: {
      type: "choice",
      choice,
      confidence,
      probabilities: { yes: choice === "yes" ? confidence : 1 - confidence, no: choice === "yes" ? 1 - confidence : confidence },
    },
    primary_gap: {
      type: "choice",
      choice: "no_website",
      confidence: 0.8,
      probabilities: { no_website: 0.8, unclear: 0.2 },
    },
    business_verifiable: { type: "noul", noul: businessVerifiable },
    evidence_sufficient: { type: "noul", noul: 0.8 },
  },
  usage: {
    input_tokens: 120,
    output_tokens: 12,
    cost_usd: 0.000026,
    credits_remaining_usd: 4.999974,
  },
});

function memoryStore(initial: LeadItem[]): OpportunityLeadStore & { state: Map<string, LeadItem> } {
  const state = new Map(initial.map((item) => [item.place_id, { ...item }]));
  return {
    state,
    async get(leadId: string) {
      return state.get(leadId);
    },
    async save(leadId, evidence, summary) {
      const current = state.get(leadId);
      if (!current) return;
      current.evidence = mergeEvidence(current.evidence, evidence);
      if (summary !== undefined) current.opportunity = summary;
    },
  };
}

/* ------------------------------------------------------------------ */
/* PASO 1: identidad determinista                                      */
/* ------------------------------------------------------------------ */

test("el id de un comercio de OSM es determinista y no usa aleatoriedad", () => {
  const place = { osm_type: "node", osm_id: 123456, place_id: 999, lat: "-24.78", lon: "-65.41" };
  const first = osmPlaceId(place);
  assert.equal(first, "osm:node/123456");
  for (let i = 0; i < 50; i += 1) assert.equal(osmPlaceId(place), first);
});

test("el id de OSM prefiere osm_type+osm_id y cae a place_id si faltan", () => {
  assert.equal(osmPlaceId({ osm_type: "way", osm_id: "77", place_id: "5" }), "osm:way/77");
  assert.equal(osmPlaceId({ place_id: "5" }), "osm:place/5");
});

test("sin identificadores, el id deriva de los datos disponibles y es estable", () => {
  const base = { name: "Ferretería El Progreso", display_name: "Av. Siempre Viva 742, Salta", lat: "-24.78", lon: "-65.41" };
  const a = osmPlaceId(base);
  const b = osmPlaceId({ ...base });
  assert.equal(a, b);
  assert.match(a, /^osm:hash\/[0-9a-f]{16}$/);

  const moved = osmPlaceId({ ...base, lat: "-24.79" });
  assert.notEqual(a, moved);

  const renamed = osmPlaceId({ ...base, name: "Otra Ferretería" });
  assert.notEqual(a, renamed);
});

test("la identidad de negocio ignora acentos, mayúsculas y signos", () => {
  const one = leadIdentity({ nombre: "Ferretería ÑANDÚ", direccion: "Av. Rivadavia 100", zona: "Salta" });
  const two = leadIdentity({ nombre: " ferreteria  nandu ", direccion: "av rivadavia 100", zona: "salta" });
  assert.equal(one, two);
  assert.equal(normalizeIdentityText("Áv. Córdoba 1234!!"), "av cordoba 1234");
});

test("la identidad prefiere coordenadas y distingue locales distintos", () => {
  const byCoords = leadIdentity({ nombre: "Almacén Don Mario", lat: "-24.78", lon: "-65.41" });
  const sameCoords = leadIdentity({ nombre: "Almacén Don Mario", direccion: "otra calle", lat: "-24.78000", lon: "-65.41000" });
  const otherPlace = leadIdentity({ nombre: "Almacén Don Mario", lat: "-24.90", lon: "-65.41" });
  assert.equal(byCoords, sameCoords);
  assert.notEqual(byCoords, otherPlace);
});

test("una búsqueda repetida no duplica el mismo comercio aunque cambie el id", () => {
  const existing: LeadItem[] = [
    lead({
      place_id: "osm:place/1",
      identity: "idn_comercio_a",
      status: "cliente",
      notes: "Contrato firmado",
      telefono: "3874000000",
    }),
    lead({ place_id: "osm:place/2", nombre: "Otro local", identity: "idn_comercio_b", status: "contactado" }),
  ];
  const found: LeadItem[] = [
    lead({ place_id: "osm:node/9", identity: "idn_comercio_a" }),
    lead({ place_id: "osm:node/9", identity: "idn_comercio_a" }),
  ];

  const merged = mergeLeadSearch(existing, found, "replace");
  assert.equal(merged.length, 2);
  const mergedBusiness = merged.find((item) => item.identity === "idn_comercio_a");
  assert.ok(mergedBusiness);
  assert.equal(mergedBusiness?.status, "cliente");
  assert.equal(mergedBusiness?.notes, "Contrato firmado");
  assert.equal(mergedBusiness?.telefono, "3874000000");
  assert.equal(merged.filter((item) => item.identity === "idn_comercio_a").length, 1);
});

test("la fusión por identidad no reintroduce el registro viejo en modo acumular", () => {
  const existing: LeadItem[] = [lead({ place_id: "osm:place/1", identity: "idn_x" })];
  const merged = mergeLeadSearch(existing, [lead({ place_id: "osm:node/1", identity: "idn_x" })], "accumulate");
  assert.equal(merged.length, 1);
  assert.equal(merged[0].place_id, "osm:node/1");
});

/* ------------------------------------------------------------------ */
/* PASO 2 y 4: evidencias y estados                                    */
/* ------------------------------------------------------------------ */

test("el estado de un campo sigue la jerarquía de evidencia", () => {
  const evidence: LeadEvidence[] = [
    makeEvidence({ field: "website", status: "not_found", source: "derived" }),
    makeEvidence({ field: "website", status: "found", value: "https://x.test", source: "google_places" }),
    makeEvidence({ field: "website", status: "verified", value: "https://x.test", source: "website" }),
    makeEvidence({ field: "email", status: "inferred", value: "a@b.test", source: "website" }),
  ];
  assert.equal(fieldStatus(evidence, "website"), "verified");
  assert.equal(fieldStatus(evidence, "email"), "inferred");
  assert.equal(fieldStatus(evidence, "phone"), "not_searched");
  assert.equal(hasSupportedValue(evidence, "website"), true);
  assert.equal(hasSupportedValue(evidence, "email"), false);
});

test("una inferencia nunca cuenta como dato respaldado", () => {
  const evidence: LeadEvidence[] = [makeEvidence({ field: "ecommerce", status: "inferred", value: true, source: "website" })];
  assert.equal(hasSupportedValue(evidence, "ecommerce"), false);
  const coverage = evidenceCoverage(evidence, ["ecommerce", "website"]);
  assert.equal(coverage.supported, 0);
  assert.equal(coverage.score, 0);
  assert.match(coverage.formula, /verificada o encontrada/);
});

test("el lenguaje distingue ausencia de dato no consultado", () => {
  const searched: LeadEvidence[] = [
    makeEvidence({ field: "website", status: "not_found", source: "derived" }),
  ];
  const text = describeFieldStatus(searched, "website", ["openstreetmap", "google_places"]);
  assert.match(text, /no encontrado en las fuentes consultadas/);
  assert.doesNotMatch(text, /no existe|no tiene/i);

  const notSearched = describeFieldStatus(undefined, "website");
  assert.match(notSearched, /no se buscó/);
});

test("la cobertura de evidencia se calcula solo con datos respaldados", () => {
  const evidence: LeadEvidence[] = [
    makeEvidence({ field: "phone", status: "found", value: "3874000000", source: "openstreetmap" }),
    makeEvidence({ field: "website", status: "not_found", source: "derived" }),
    makeEvidence({ field: "ecommerce", status: "inferred", value: true, source: "website" }),
  ];
  const coverage = evidenceCoverage(evidence, ["phone", "website", "ecommerce", "email"]);
  assert.equal(coverage.supported, 1);
  assert.equal(coverage.total, 4);
  assert.equal(coverage.score, 0.25);
  assert.equal(coverage.fields.website, "not_found");
});

test("mergeEvidence no duplica y conserva lo que ya existía", () => {
  const first = makeEvidence({ field: "phone", status: "found", value: "1", source: "openstreetmap" });
  const second = makeEvidence({ field: "phone", status: "found", value: "1", source: "openstreetmap" });
  const merged = mergeEvidence([first], [second, makeEvidence({ field: "email", status: "found", value: "a@b.test", source: "website" })]);
  assert.equal(merged.length, 2);
});

/* ------------------------------------------------------------------ */
/* PASO 3: enriquecimiento                                             */
/* ------------------------------------------------------------------ */

const SAMPLE_HTML = `<!doctype html><html><head><title>Ferretería</title></head><body>
<a href="https://instagram.com/ferreteriaprogreso">IG</a>
<a href="https://facebook.com/ferreteriaprogreso">FB</a>
<a href="https://wa.me/5493874000000">WhatsApp</a>
<a href="mailto:ventas@ferreteriaprogreso.com.ar">Mail</a>
<a href="tel:+543874000000">Llamar</a>
<button class="add-to-cart">Agregar al carrito</button>
<section><h2>Catálogo de productos</h2></section>
</body></html>`;

test("el enriquecimiento extrae datos públicos del sitio declarado", async () => {
  const result = await enrichLead(
    lead({ website: "ferreteriaprogreso.com.ar" }),
    undefined,
    {
      fetchImpl: async () => ({ body: Buffer.from(SAMPLE_HTML, "utf8"), contentType: "text/html" }),
      pauseMs: 0,
    },
  );

  const status = (field: string) => fieldStatus(result.evidence, field as never);
  assert.equal(status("website"), "verified");
  assert.equal(status("email"), "found");
  assert.equal(status("instagram"), "found");
  assert.equal(status("facebook"), "found");
  assert.equal(status("whatsapp"), "found");
  assert.equal(status("ecommerce"), "inferred");
  assert.equal(result.findings.emails[0], "ventas@ferreteriaprogreso.com.ar");
  assert.ok(result.pagesFetched.length >= 1);
});

test("sin sitio en las fuentes consultadas se registra ausencia, no una afirmación", async () => {
  const result = await enrichLead(lead(), undefined, { skipFetch: false });
  assert.equal(fieldStatus(result.evidence, "website"), "not_found");
  const note = result.evidence.find((item) => item.field === "website")?.notes || "";
  assert.match(note, /no se encontró sitio web declarado en las fuentes consultadas/i);
});

test("en modo local no se consulta nada y el sitio queda como no buscado", async () => {
  const result = await enrichLead(lead(), undefined, { skipFetch: true });
  assert.equal(result.skipped, true);
  assert.equal(fieldStatus(result.evidence, "website"), "not_searched");
  assert.equal(result.pagesFetched.length, 0);
});

test("si el sitio declarado no responde, no se afirma nada sobre su contenido", async () => {
  const result = await enrichLead(lead({ website: "sitio-que-no-responde.test" }), undefined, {
    fetchImpl: async () => {
      throw new Error("El sitio tardó demasiado en responder.");
    },
    pauseMs: 0,
  });
  assert.equal(fieldStatus(result.evidence, "website"), "unknown");
  assert.ok(result.errors.length > 0);
  assert.equal(result.pagesFetched.length, 0);
});

test("los extractores de HTML filtran ruido y normalizan enlaces", () => {
  assert.deepEqual(extractEmails("hola@negocio.com.ar y algo@example.com y logo@2x.png"), [
    "hola@negocio.com.ar",
  ]);
  assert.equal(normalizeWebsiteUrl("negocio.com.ar"), "https://negocio.com.ar");
  assert.equal(normalizeWebsiteUrl("javascript:alert(1)"), "");
  const socials = extractSocialLinks(SAMPLE_HTML + SAMPLE_HTML);
  assert.equal(socials.instagram.length, 1);
  assert.ok(socials.whatsapp[0].includes("wa.me"));
  const commerce = detectCommerceSignals(SAMPLE_HTML);
  assert.equal(commerce.ecommerce, true);
  assert.equal(commerce.catalog, true);
});

/* ------------------------------------------------------------------ */
/* PASO 5: Jev                                                         */
/* ------------------------------------------------------------------ */

test("sin JEV_API_KEY el error es claro y no se llama a la red", async () => {
  const patched = patchFetch(() => {
    throw new Error("no debería llamarse");
  });
  try {
    const decision = await askJev(
      buildOpportunitySignals(lead(), undefined),
      undefined,
      { apiKey: "" },
    );
    assert.equal(decision.ok, false);
    assert.match(decision.error || "", /JEV_API_KEY/);
    assert.equal(patched.calls.length, 0);
  } finally {
    patched.restore();
  }
});

test("el ruteo usa la confianza y se decide en código", () => {
  const yes = { choice: "yes", confidence: 0.9, probabilities: {} };
  const no = { choice: "no", confidence: 0.9, probabilities: {} };
  const unsure = { choice: "yes", confidence: JEV_CONFIDENCE_THRESHOLD - 0.1, probabilities: {} };
  assert.equal(routeJevDecision(yes, { noul: 0.9 }).routing, "continue");
  assert.equal(routeJevDecision(no, { noul: 0.9 }).routing, "discard");
  assert.equal(routeJevDecision(unsure, { noul: 0.9 }).routing, "review");
  assert.equal(routeJevDecision(yes, { noul: 0.1 }).routing, "discard");
});

test("se parsea la respuesta oficial de Jev y se conserva el modelo", async () => {
  const patched = patchFetch(() => jsonResponse(jevAnswer("yes", 0.88)));
  try {
    const decision = await askJev(buildOpportunitySignals(lead(), undefined), undefined, {
      apiKey: "jv_live_test_key",
    });
    assert.equal(decision.ok, true);
    assert.equal(decision.model, "jev-test-1");
    assert.equal(decision.routing, "continue");
    assert.equal(decision.worthDeepAnalysis?.choice, "yes");
    assert.equal(decision.primaryGap?.choice, "no_website");
    assert.equal(decision.usage?.input_tokens, 120);
    assert.equal(decision.usage?.cost_usd, 0.000026);
    assert.equal(decision.usage?.credits_remaining_usd, 4.999974);
    assert.ok(decision.latencyMs >= 0);
    assert.equal(patched.calls[0], "https://jevtypesafeai.com/api/v1/decide");
  } finally {
    patched.restore();
  }
});

test("una respuesta incompleta o inválida de Jev no se inventa", async () => {
  const missing = patchFetch(() => jsonResponse({ model: "jev", answers: {} }));
  try {
    const decision = await askJev(buildOpportunitySignals(lead(), undefined), undefined, { apiKey: "k" });
    assert.equal(decision.ok, false);
    assert.match(decision.error || "", /worth_deep_analysis/);
  } finally {
    missing.restore();
  }

  const broken = patchFetch(() => new Response("no soy json", { status: 200 }));
  try {
    const decision = await askJev(buildOpportunitySignals(lead(), undefined), undefined, { apiKey: "k" });
    assert.equal(decision.ok, false);
    assert.match(decision.error || "", /no es JSON|respuesta/i);
  } finally {
    broken.restore();
  }
});

test("una credencial rechazada por Jev se informa sin exponer la clave", async () => {
  const patched = patchFetch(() => new Response("unauthorized", { status: 401 }));
  try {
    const decision = await askJev(buildOpportunitySignals(lead(), undefined), undefined, {
      apiKey: "sk-secreta-de-prueba",
    });
    assert.equal(decision.ok, false);
    assert.match(decision.error || "", /401/);
    assert.doesNotMatch(decision.error || "", /sk-secreta-de-prueba/);
  } finally {
    patched.restore();
  }
});

/* ------------------------------------------------------------------ */
/* PASO 6: análisis con DeepSeek                                       */
/* ------------------------------------------------------------------ */

test("el JSON del analista se normaliza y filtra valores ajenos", () => {
  const parsed = normalizeAnalysisJson(
    JSON.stringify({
      opportunityDetected: true,
      opportunityType: "presencia_online",
      problemDetected: "Sin sitio web encontrado en las fuentes consultadas",
      evidenceUsed: ["website", "phone", "campo_inventado"],
      proposedSolution: "Landing page con catálogo",
      recommendedProducts: ["landing", "producto_inexistente"],
      reasoning: "El comercio tiene teléfono pero no sitio web.",
      confidence: 0.99,
    }),
  );
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data?.evidenceUsed, ["website", "phone"]);
  assert.deepEqual(parsed.data?.recommendedProducts, ["landing"]);
});

test("si el analista no devuelve JSON válido se reporta un error claro", () => {
  assert.equal(normalizeAnalysisJson("texto plano").ok, false);
  assert.equal(normalizeAnalysisJson('{"opportunityType":"x"}').ok, false);
  assert.equal(
    normalizeAnalysisJson(JSON.stringify({ opportunityDetected: true })).ok,
    true,
  );
});

test("el análisis devuelve la cobertura de evidencia calculada en código", async () => {
  const patched = patchFetch(() =>
    jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              opportunityDetected: false,
              opportunityType: null,
              problemDetected: null,
              evidenceUsed: [],
              proposedSolution: null,
              recommendedProducts: [],
              reasoning: "Sin evidencia suficiente.",
            }),
          },
        },
      ],
    }),
  );
  try {
    const analysis = await analyzeWithDeepSeek(
      {
        lead: lead(),
        evidence: [makeEvidence({ field: "phone", status: "found", value: "1", source: "openstreetmap" })],
      },
      { settings: { provider: "deepseek", deepseekApiKey: "test" } },
    );
    assert.equal(analysis.ok, true);
    assert.equal(analysis.opportunityDetected, false);
    assert.equal(analysis.model, "deepseek-flash");
    assert.equal(analysis.evidenceCoverage.supported, 1);
    assert.match(analysis.evidenceCoverage.formula, /campos evaluados/);
  } finally {
    patched.restore();
  }
});

test("si el analista falla, el resultado queda marcado y explicado", async () => {
  const patched = patchFetch(() => new Response("peticion rechazada de prueba", { status: 400 }));
  try {
    const analysis = await analyzeWithDeepSeek(
      { lead: lead(), evidence: [] },
      { settings: { provider: "deepseek", deepseekApiKey: "test" } },
    );
    assert.equal(analysis.ok, false);
    assert.match(analysis.error || "", /400|Error en llamada/i);
  } finally {
    patched.restore();
  }
});

/* ------------------------------------------------------------------ */
/* PASO 7, 9 y 10: pipeline, observabilidad y concurrencia             */
/* ------------------------------------------------------------------ */

test("si Jev descarta, el pipeline se detiene y no llama a DeepSeek", async () => {
  const store = memoryStore([lead()]);
  const dir = mkdtempSync(path.join(os.tmpdir(), "hub-opp-"));
  const logFile = path.join(dir, "analyses.json");
  const patched = patchFetch((url) => {
    if (url.includes("api.typesafe.ai")) return jsonResponse(jevAnswer("no", 0.95));
    if (url.includes("api.deepseek.com")) return jsonResponse({ choices: [{ message: { content: "{}" } }] });
    throw new Error(`llamada inesperada: ${url}`);
  });

  try {
    const result = await analyzeOpportunity(lead(), {
      skipEnrichment: true,
      store,
      logFile,
      jev: { apiKey: "test" },
      analysis: { settings: { provider: "deepseek", deepseekApiKey: "test" } },
    });
    assert.equal(result.stage, "jev");
    assert.equal(result.jev?.routing, "discard");
    assert.equal(result.analysis, undefined);
    assert.equal(patched.calls.filter((url) => url.includes("api.deepseek.com")).length, 0);
    assert.equal(store.state.get("osm:node/1")?.opportunity?.detected, false);
    const records = readOpportunityLog(logFile);
    assert.equal(records.length, 1);
    assert.equal(records[0].passedToDeepSeek, false);
    assert.equal(records[0].finalStage, "jev");
  } finally {
    patched.restore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("si Jev continúa, el pipeline analiza y guarda evidencia y resumen", async () => {
  const store = memoryStore([lead()]);
  const dir = mkdtempSync(path.join(os.tmpdir(), "hub-opp-"));
  const logFile = path.join(dir, "analyses.json");
  const patched = patchFetch((url) => {
    if (url.includes("api.typesafe.ai")) return jsonResponse(jevAnswer("yes", 0.91));
    if (url.includes("api.deepseek.com"))
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                opportunityDetected: true,
                opportunityType: "presencia_online",
                problemDetected: "No se encontró sitio web en las fuentes consultadas",
                evidenceUsed: ["website"],
                proposedSolution: "Landing page con catálogo y contacto directo",
                recommendedProducts: ["landing"],
                reasoning: "Sin sitio web y con teléfono verificado.",
              }),
            },
          },
        ],
      });
    throw new Error(`llamada inesperada: ${url}`);
  });

  try {
    const result = await analyzeOpportunity(lead(), {
      skipEnrichment: true,
      store,
      logFile,
      jev: { apiKey: "test" },
      analysis: { settings: { provider: "deepseek", deepseekApiKey: "test" } },
    });
    assert.equal(result.ok, true);
    assert.equal(result.stage, "done");
    assert.equal(result.analysis?.opportunityDetected, true);
    assert.equal(result.analysis?.recommendedProducts?.[0], "landing");
    assert.equal(patched.calls.filter((url) => url.includes("api.deepseek.com")).length, 1);

    const stored = store.state.get("osm:node/1");
    assert.equal(stored?.opportunity?.detected, true);
    assert.ok((stored?.evidence || []).some((item) => item.field === "website"));
    assert.equal(result.durationMs >= 0, true);

    const records = readOpportunityLog(logFile);
    assert.equal(records.length, 1);
    assert.equal(records[0].passedToDeepSeek, true);
    assert.equal(records[0].jev.routing, "continue");
    assert.equal(records[0].deepseek?.model, "deepseek-flash");
    assert.equal(JSON.stringify(records[0]).includes("test-key"), false);
  } finally {
    patched.restore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dos solicitudes simultáneas del mismo prospecto comparten una corrida", async () => {
  const store = memoryStore([lead()]);
  const dir = mkdtempSync(path.join(os.tmpdir(), "hub-opp-"));
  const logFile = path.join(dir, "analyses.json");
  let jevCalls = 0;
  const patched = patchFetch((url) => {
    if (url.includes("api.typesafe.ai")) {
      jevCalls += 1;
      return jsonResponse(jevAnswer("no", 0.9));
    }
    throw new Error(`llamada inesperada: ${url}`);
  });

  try {
    const options = { skipEnrichment: true, store, logFile, jev: { apiKey: "test" }, skipAnalysis: true };
    const [first, second] = await Promise.all([
      analyzeOpportunity(lead(), options),
      analyzeOpportunity(lead(), options),
    ]);
    assert.equal(jevCalls, 1);
    assert.equal(first.logId, second.logId);
    assert.equal(isAnalysisInFlight("osm:node/1"), false);
  } finally {
    patched.restore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("un fallo de Jev no destruye evidencia y queda registrado", async () => {
  const store = memoryStore([
    lead({ evidence: [makeEvidence({ field: "phone", status: "found", value: "1", source: "openstreetmap" })] }),
  ]);
  const dir = mkdtempSync(path.join(os.tmpdir(), "hub-opp-"));
  const logFile = path.join(dir, "analyses.json");
  const patched = patchFetch(() => new Response("boom", { status: 500 }));

  try {
    const result = await analyzeOpportunity(lead(), {
      skipEnrichment: true,
      skipAnalysis: true,
      store,
      logFile,
      jev: { apiKey: "test" },
    });
    assert.equal(result.ok, false);
    assert.ok((result.error || "").length > 0);
    const stored = store.state.get("osm:node/1");
    assert.ok((stored?.evidence || []).some((item) => item.field === "phone"));
    const records = readOpportunityLog(logFile);
    assert.equal(records.length, 1);
    assert.equal(records[0].jev.ok, false);
    assert.ok(records[0].errors.length > 0);
  } finally {
    patched.restore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("el registro de observabilidad acumula análisis", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "hub-log-"));
  const file = path.join(dir, "analyses.json");
  const record = {
    id: "1",
    timestamp: new Date().toISOString(),
    leadId: "osm:node/1",
    signalsVersion: "signals-v1",
    signals: buildOpportunitySignals(lead(), undefined),
    jev: { ok: true, latencyMs: 12, routing: "continue" as const },
    passedToDeepSeek: true,
    finalStage: "done" as const,
    errors: [],
    durationMs: 30,
  };
  try {
    await appendOpportunityLog(record, file);
    await appendOpportunityLog({ ...record, id: "2" }, file);
    const records = readOpportunityLog(file);
    assert.equal(records.length, 2);
    assert.equal(records[0].id, "1");
    assert.equal(records[1].id, "2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("las señales describen solo lo que la evidencia respalda", () => {
  const evidence: LeadEvidence[] = [
    makeEvidence({ field: "website", status: "not_found", source: "derived" }),
    makeEvidence({ field: "phone", status: "found", value: "1", source: "openstreetmap" }),
    makeEvidence({ field: "ecommerce", status: "inferred", value: true, source: "website" }),
  ];
  const signals = buildOpportunitySignals(lead(), evidence);
  assert.equal(signals.website.present, false);
  assert.equal(signals.website.searched, true);
  assert.equal(signals.hasPhone, true);
  assert.equal(signals.hasEcommerce, false);
  assert.equal(signals.contactable, true);
  assert.ok(signals.notSearched.includes("instagram"));
  assert.ok(signals.consultedSources.includes("openstreetmap"));
});

/* ------------------------------------------------------------------ */
/* API hospedada de decisiones (/api/v1/decide)                        */
/* ------------------------------------------------------------------ */

test("las claves jv_live_ usan la API hospedada y las demas el servicio en la nube", () => {
  assert.equal(resolveJevEndpoint("jv_live_abc"), "https://jevtypesafeai.com/api/v1/decide");
  assert.equal(resolveJevEndpoint("jv_otro_abc"), "https://api.typesafe.ai/v1/systemone");
  assert.equal(resolveJevEndpoint(""), "https://api.typesafe.ai/v1/systemone");
  assert.equal(
    resolveJevEndpoint("jv_live_abc", "http://127.0.0.1:9000/decide"),
    "http://127.0.0.1:9000/decide",
  );
  const config = resolveJevConfig({ apiKey: "jv_live_de_prueba" });
  assert.equal(config.endpoint, "https://jevtypesafeai.com/api/v1/decide");
  assert.equal(config.model, "jev-latest");
  assert.equal(config.configured, true);
});

test("las preguntas noul no llevan criteria en este contrato", () => {
  const questions = buildQuestions();
  assert.equal(questions.worth_deep_analysis.type, "choice");
  assert.equal(questions.primary_gap.type, "choice");
  assert.ok(questions.worth_deep_analysis.criteria);
  assert.equal(questions.business_verifiable.type, "noul");
  assert.equal(questions.evidence_sufficient.type, "noul");
  assert.equal("criteria" in questions.business_verifiable, false);
  assert.equal("criteria" in questions.evidence_sufficient, false);
  assert.deepEqual(Object.keys(questions).sort(), [
    "business_verifiable",
    "evidence_sufficient",
    "primary_gap",
    "worth_deep_analysis",
  ]);
});

test("el cuerpo enviado tiene la forma documentada para /api/v1/decide", async () => {
  const original = globalThis.fetch;
  let capturedUrl = "";
  let capturedAuth = "";
  let capturedBody: Record<string, unknown> = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = (init?.headers || {}) as Record<string, string>;
    capturedAuth = headers.Authorization;
    capturedBody =
      typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    return jsonResponse(jevAnswer("yes", 0.9));
  }) as typeof fetch;

  try {
    await askJev(buildOpportunitySignals(lead(), undefined), undefined, {
      apiKey: "jv_live_clave_de_prueba",
    });

    assert.equal(capturedUrl, "https://jevtypesafeai.com/api/v1/decide");
    assert.equal(capturedAuth, "Bearer jv_live_clave_de_prueba");
    assert.equal(capturedBody.model, "jev-latest");
    assert.ok(capturedBody.state);
    const sentQuestions = capturedBody.questions as Record<string, Record<string, unknown>>;
    assert.equal(sentQuestions.worth_deep_analysis.type, "choice");
    const gapCriteria = sentQuestions.primary_gap.criteria as Record<string, string>;
    assert.equal("no_website" in gapCriteria, true);
    assert.equal("criteria" in sentQuestions.business_verifiable, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("los errores documentados de la API de decisiones se explican", async () => {
  const cases: { status: number; body: string; pattern: RegExp }[] = [
    { status: 400, body: JSON.stringify({ error: "questions: invalid type" }), pattern: /400/ },
    {
      status: 401,
      body: JSON.stringify({ error: "invalid api key" }),
      pattern: /credencial \(401\)/,
    },
    {
      status: 402,
      body: JSON.stringify({ error: "not enough credits", code: "insufficient_credits" }),
      pattern: /insufficient_credits/i,
    },
    { status: 403, body: JSON.stringify({ error: "account inactive" }), pattern: /inactiva/ },
    { status: 404, body: JSON.stringify({ error: "unknown endpoint" }), pattern: /404/ },
    { status: 429, body: JSON.stringify({ error: "too many requests" }), pattern: /429/ },
    { status: 502, body: JSON.stringify({ error: "upstream error" }), pattern: /502/ },
  ];

  for (const item of cases) {
    const patched = patchFetch(() => new Response(item.body, { status: item.status }));
    try {
      const decision = await askJev(buildOpportunitySignals(lead(), undefined), undefined, {
        apiKey: "jv_live_clave_de_prueba",
      });
      assert.equal(decision.ok, false);
      assert.match(decision.error || "", item.pattern);
      assert.doesNotMatch(decision.error || "", /jv_live_clave_de_prueba/);
    } finally {
      patched.restore();
    }
  }
});

test("el uso devuelto se mapea sin inventar valores", () => {
  assert.deepEqual(
    mapJevUsage({ input_tokens: 62, cost_usd: 0.000026, credits_remaining_usd: 4.999974 }),
    {
      input_tokens: 62,
      output_tokens: undefined,
      cost_usd: 0.000026,
      credits_remaining_usd: 4.999974,
    },
  );
  assert.equal(mapJevUsage({}), undefined);
  assert.equal(mapJevUsage(null), undefined);
  assert.equal(mapJevUsage("62"), undefined);
});

test("una respuesta sin answers se reporta como invalida", async () => {
  const patched = patchFetch(() => jsonResponse({ model: "jev-1.13.0" }));
  try {
    const decision = await askJev(buildOpportunitySignals(lead(), undefined), undefined, {
      apiKey: "jv_live_clave_de_prueba",
    });
    assert.equal(decision.ok, false);
    assert.match(decision.error || "", /worth_deep_analysis/);
  } finally {
    patched.restore();
  }
});

