import test from "node:test";
import assert from "node:assert/strict";

import {
  COMMERCIAL_CATEGORIES,
  categoryTags,
  normalizeCategoryText,
  resolveCategory,
} from "../src/lib/commercial-taxonomy";
import { buildCategoryQuery } from "../src/lib/overpass";
import {
  candidateEvidence,
  candidateFromOsm,
  candidateToLead,
  dedupeCandidates,
  discoverLeads,
  importCandidates,
  scoreLeadQuality,
} from "../src/lib/lead-discovery";
import type { LeadCandidate } from "../src/lib/lead-discovery";
import { getLeads } from "../src/lib/leads-service";

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const AREA = { south: -24.9, west: -65.5, north: -24.6, east: -65.3 };
const DISCOVERED_AT = "2026-09-22T00:00:00.000Z";

const FULL_TAGS: Record<string, string> = {
  name: "Ferretería López",
  shop: "hardware",
  "addr:street": "Mitre",
  "addr:housenumber": "100",
  "addr:city": "Salta",
  "addr:province": "Salta",
  "addr:country": "AR",
  "contact:phone": "+54 387 400-0000",
  "contact:website": "https://lopez.com.ar",
  "contact:email": "hola@lopez.com.ar",
  "contact:instagram": "https://instagram.com/ferreterialopez",
  "contact:facebook": "https://facebook.com/ferreterialopez",
  opening_hours: "Mo-Fr 09:00-18:00",
  brand: "López",
  operator: "Familia López",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Respuestas simuladas: nunca se llama a un servicio real. */
function fakeServices(elements: unknown[]) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    if (String(url).includes("nominatim")) {
      return jsonResponse([
        {
          display_name: "Salta Capital, Salta, Argentina",
          lat: "-24.78",
          lon: "-65.41",
          class: "place",
          type: "city",
          place_rank: 16,
          importance: 0.6,
          boundingbox: ["-24.9", "-24.6", "-65.5", "-65.3"],
        },
      ]);
    }
    return jsonResponse({ elements });
  }) as never;
  return { calls, impl };
}

/* ------------------------------------------------------------------ */
/* Taxonomía y consulta                                                */
/* ------------------------------------------------------------------ */

test("la taxonomía resuelve categorías escritas de varias formas", () => {
  assert.equal(COMMERCIAL_CATEGORIES.length, 10);
  assert.equal(resolveCategory("ferretería")?.id, "ferreteria");
  assert.equal(resolveCategory("FERRETERIAS")?.id, "ferreteria");
  assert.equal(resolveCategory("gimnasio")?.id, "gimnasio");
  assert.equal(resolveCategory("repuestos automotor")?.id, "repuestos_automotor");
  assert.equal(resolveCategory("muebleria")?.id, "muebles");
  assert.equal(resolveCategory("categoria inexistente"), undefined);
  assert.equal(normalizeCategoryText("Ferretería"), "ferreteria");
});

test("cada categoría expone sus etiquetas OSM reales", () => {
  const ferreteria = resolveCategory("ferreteria");
  assert.ok(ferreteria);
  assert.deepEqual(categoryTags(ferreteria!), ["shop=hardware", "shop=doityourself"]);
  const gimnasio = resolveCategory("gimnasio");
  assert.ok(categoryTags(gimnasio!).includes("leisure=fitness_centre"));
});

test("la consulta Overpass usa ajustes, bbox y tope de resultados", () => {
  const query = buildCategoryQuery([{ key: "shop", value: "hardware" }], AREA, 20);
  assert.ok(query.startsWith("[out:json][timeout:25];"));
  assert.ok(query.includes('"shop"="hardware"'));
  assert.ok(query.includes("-24.9,-65.5,-24.6,-65.3"));
  assert.ok(query.includes("node"));
  assert.ok(query.includes("way"));
  assert.ok(query.includes("relation"));
  assert.ok(query.includes("out center tags 20;"));
});

/* ------------------------------------------------------------------ */
/* Candidato y tags de contacto                                        */
/* ------------------------------------------------------------------ */

test("un elemento de OSM se convierte en candidato con provenance y contact:*", () => {
  const category = resolveCategory("ferreteria")!;
  const candidate = candidateFromOsm(
    { type: "node", id: 42, lat: -24.78, lon: -65.41, tags: FULL_TAGS },
    category,
    "Salta Capital, Salta, Argentina",
    DISCOVERED_AT,
  );
  assert.equal(candidate.source, "openstreetmap");
  assert.equal(candidate.sourceId, "osm:node/42");
  assert.equal(candidate.sourceUrl, "https://www.openstreetmap.org/node/42");
  assert.equal(candidate.name, "Ferretería López");
  assert.equal(candidate.address, "Mitre 100");
  assert.equal(candidate.city, "Salta");
  assert.equal(candidate.province, "Salta");
  assert.equal(candidate.country, "AR");
  assert.equal(candidate.phone, "+54 387 400-0000");
  assert.equal(candidate.website, "https://lopez.com.ar");
  assert.equal(candidate.email, "hola@lopez.com.ar");
  assert.equal(candidate.socialLinks?.instagram, "https://instagram.com/ferreterialopez");
  assert.equal(candidate.openingHours, "Mo-Fr 09:00-18:00");
  assert.equal(candidate.brand, "López");
  assert.equal(candidate.operator, "Familia López");
  assert.deepEqual(candidate.coordinates, { lat: -24.78, lon: -65.41 });
  assert.equal(candidate.rawTags.shop, "hardware");
});

test("los campos ausentes no se inventan", () => {
  const candidate = candidateFromOsm(
    { type: "way", id: 7, center: { lat: -24.7, lon: -65.4 }, tags: { name: "Solo Nombre" } },
    resolveCategory("ferreteria")!,
    "Salta",
    DISCOVERED_AT,
  );
  assert.equal(candidate.phone, undefined);
  assert.equal(candidate.website, undefined);
  assert.equal(candidate.email, undefined);
  assert.equal(candidate.address, undefined);
  assert.deepEqual(candidate.coordinates, { lat: -24.7, lon: -65.4 });
});

/* ------------------------------------------------------------------ */
/* Quality gate                                                        */
/* ------------------------------------------------------------------ */

test("el quality gate acepta un negocio identificable (aunque no tenga web)", () => {
  const quality = scoreLeadQuality(
    {
      name: "Ferretería López",
      categoryId: "ferreteria",
      address: "Mitre 100",
      city: "Salta",
      coordinates: { lat: -24.78, lon: -65.41 },
      phone: "+54 387 400-0000",
    },
    "Salta Capital",
  );
  assert.equal(quality.tier, "lead_accepted");
  assert.ok(quality.score >= 60);

  const sinWeb = scoreLeadQuality(
    {
      name: "Ferretería Sin Web",
      categoryId: "ferreteria",
      address: "Belgrano 50",
      city: "Salta",
    },
    "Salta Capital",
  );
  assert.equal(sinWeb.tier, "lead_accepted");
});

test("el quality gate rechaza sin nombre o sin ubicación y marca identidad débil", () => {
  const sinNombre = scoreLeadQuality(
    { name: "   ", categoryId: "ferreteria", city: "Salta" },
    "Salta Capital",
  );
  assert.equal(sinNombre.tier, "candidate_rejected");
  assert.ok(sinNombre.reasons.includes("missing_name"));

  const sinUbicacion = scoreLeadQuality(
    { name: "Ferretería López", categoryId: "ferreteria" },
    "",
  );
  assert.equal(sinUbicacion.tier, "candidate_rejected");
  assert.ok(sinUbicacion.reasons.includes("missing_location"));

  const debil = scoreLeadQuality({ name: "Bar", categoryId: "gimnasio" }, "Salta Capital");
  assert.equal(debil.tier, "candidate_ambiguous");
  assert.ok(debil.reasons.includes("weak_identity"));
});

/* ------------------------------------------------------------------ */
/* Deduplicación                                                       */
/* ------------------------------------------------------------------ */

function candidate(over: Partial<LeadCandidate> = {}): LeadCandidate {
  const category = resolveCategory("ferreteria")!;
  const base = candidateFromOsm(
    { type: "node", id: 1, lat: -24.78, lon: -65.41, tags: FULL_TAGS },
    category,
    "Salta",
    DISCOVERED_AT,
  );
  const merged = { ...base, ...over };
  const quality = scoreLeadQuality(merged, "Salta");
  return {
    ...merged,
    quality,
    classification: quality.tier,
    reason: quality.reasons[0] || "accepted",
    ...over,
  };
}

test("deduplica por id de origen y por identidad dentro del lote", () => {
  const first = candidate();
  const sameId = candidate();
  const sameIdentity = candidate({ sourceId: "osm:node/99" });
  const report = dedupeCandidates([first, sameId, sameIdentity], []);
  const duplicates = report.candidates.filter((item) => item.reason === "duplicate");
  assert.equal(duplicates.length, 2);
  assert.equal(report.duplicatesAvoided, 2);
  assert.equal(
    report.candidates.filter((item) => item.classification === "lead_accepted").length,
    1,
  );
});

test("un conflicto de identidad con un lead existente queda como ambiguo, no se fusiona", () => {
  const existing = [
    {
      place_id: "osm:node/500",
      nombre: "Ferretería López",
      rubro: "Ferretería",
      zona: "Salta Capital, Salta",
      direccion: "Mitre 100, Salta",
      telefono: "+54 387 400-0000",
      website: "",
      email: "",
      status: "nuevo" as const,
    },
  ];
  const weakMatch = candidate({
    sourceId: "osm:node/77",
    name: "Ferretería López Salta",
    address: undefined,
    coordinates: undefined,
    phone: undefined,
    website: undefined,
  });
  const report = dedupeCandidates([weakMatch], existing);
  assert.equal(report.candidates[0].classification, "candidate_ambiguous");
  assert.equal(report.candidates[0].reason, "identity_conflict");
  assert.equal(report.identityConflicts, 1);
  assert.equal(report.candidates[0].duplicateOf, "osm:node/500");
});

/* ------------------------------------------------------------------ */
/* Vista previa y conversión a lead                                    */
/* ------------------------------------------------------------------ */

test("la vista previa clasifica candidatos y NO persiste nada", async () => {
  const before = getLeads().length;
  const services = fakeServices([
    {
      type: "node",
      id: 1,
      lat: -24.78,
      lon: -65.41,
      tags: {
        ...FULL_TAGS,
        name: "Zzz Repuestos Industriales Beta",
        "addr:street": "Calle Falsa",
        "addr:housenumber": "1234",
      },
    },
    { type: "node", id: 2, lat: -24.79, lon: -65.42, tags: { shop: "hardware" } },
  ]);
  const result = await discoverLeads({
    location: "Salta Capital",
    category: resolveCategory("ferreteria")!,
    max: 20,
    requestImpl: services.impl,
  });
  assert.equal(result.metrics.candidatesFound, 2);
  assert.equal(result.metrics.leadsCreated, 1);
  assert.ok(result.metrics.candidatesRejected >= 1);
  assert.equal(result.metrics.searxngQueries, 0);
  assert.equal(result.metrics.requestsBySource.overpass, 1);
  assert.equal(result.metrics.requestsBySource.nominatim, 1);
  assert.ok(result.metrics.durationBySource.total !== undefined);
  assert.equal(getLeads().length, before);
  assert.equal(services.calls.length, 2);
});

test("un candidato aceptado se convierte en lead con evidencia trazable", () => {
  const item = candidate();
  const evidence = candidateEvidence(item);
  assert.ok(evidence.some((entry) => entry.field === "name" && entry.source === "openstreetmap"));
  assert.ok(
    evidence.some(
      (entry) => entry.field === "phone" && entry.sourceUrl === "https://www.openstreetmap.org/node/1",
    ),
  );
  assert.ok(
    evidence.some((entry) => entry.field === "rating" && entry.status === "not_found"),
  );

  const lead = candidateToLead(item, "Salta Capital, Salta, Argentina");
  assert.equal(lead.place_id, "osm:node/1");
  assert.equal(lead.nombre, "Ferretería López");
  assert.equal(lead.rubro, "Ferretería");
  assert.equal(lead.zona, "Salta Capital, Salta");
  assert.equal(lead.telefono, "+54 387 400-0000");
  assert.equal(lead.website, "https://lopez.com.ar");
  assert.ok(lead.identity);
  assert.equal(lead.status, "nuevo");
});

test("la importación sin selección no escribe nada", () => {
  const before = getLeads().length;
  const rejected = {
    ...candidate(),
    classification: "candidate_rejected" as const,
    reason: "missing_name" as const,
  };
  const result = importCandidates([rejected], "Salta");
  assert.deepEqual(result.imported, []);
  assert.equal(result.skipped, 1);
  assert.equal(getLeads().length, before);
});
