import { leadIdentity, normalizeIdentityText, osmPlaceId } from "./lead-identity";
import { matchBusinessIdentity } from "./identity-match";
import { makeEvidence } from "./lead-evidence";
import type { LeadEvidence } from "./lead-evidence";
import { mergeLeadSearch } from "./lead-merge";
import { getLeads, saveLeads } from "./leads-service";
import type { LeadItem } from "./leads-service";
import type { CommercialCategory } from "./commercial-taxonomy";
import { categoryTags } from "./commercial-taxonomy";
import {
  ALLOWED_RADIUS_KM,
  DEFAULT_RADIUS_KM,
  bboxDimensions,
  buildCategoryQuery,
  geocodeArea,
  queryOverpass,
  radiusBoundingBox,
} from "./overpass";
import type { BoundingBox, OverpassElement } from "./overpass";
import type { fetchWithRetry } from "./fetch-helper";

/**
 * Lead Discovery Engine.
 *
 * Encuentra negocios reales en fuentes gratuitas (OpenStreetMap vía Overpass,
 * con la zona resuelta por Nominatim), los normaliza, resuelve identidad,
 * deduplica y aplica un *quality gate* de IDENTIFICABILIDAD antes de proponer
 * un prospecto. NO contacta a nadie y NO importa nada sin acción humana.
 *
 * Es deliberadamente distinto del Digital Business Discovery: este módulo
 * encuentra el negocio; aquel investiga su huella digital.
 */

export const CANDIDATE_DISCOVERED_LIMIT = 200;

export type CandidateClassification =
  | "lead_accepted"
  | "candidate_ambiguous"
  | "candidate_rejected";

export type CandidateReason =
  | "missing_name"
  | "missing_location"
  | "missing_category"
  | "weak_identity"
  | "unsupported_category"
  | "duplicate"
  | "identity_conflict"
  | "accepted";

export interface LeadQuality {
  /** 0-100. Mide qué tan identificable es el registro, NO qué buen cliente es. */
  score: number;
  tier: CandidateClassification;
  reasons: CandidateReason[];
  notes: string[];
}

export interface LeadCandidate {
  source: "openstreetmap";
  sourceId: string;
  sourceUrl: string;
  name: string;
  categoryId: string;
  categoryLabel: string;
  osmTags: string[];
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  coordinates?: { lat: number; lon: number };
  phone?: string;
  email?: string;
  website?: string;
  openingHours?: string;
  brand?: string;
  operator?: string;
  socialLinks?: { instagram?: string; facebook?: string };
  rawTags: Record<string, string>;
  discoveredAt: string;
  quality: LeadQuality;
  classification: CandidateClassification;
  reason: CandidateReason;
  duplicateOf?: string;
}

export interface DiscoveryMetrics {
  candidatesFound: number;
  candidatesRejected: number;
  candidatesAmbiguous: number;
  leadsCreated: number;
  duplicatesAvoided: number;
  requestsBySource: Record<string, number>;
  durationBySource: Record<string, number>;
  searxngQueries: number;
  costNote: string;
}

export interface DiscoveryResult {
  areaName: string;
  categoryId: string;
  categoryLabel: string;
  boundingBox: BoundingBox;
  candidates: LeadCandidate[];
  metrics: DiscoveryMetrics;
  errors: string[];
  /** Cómo se resolvió la zona (observabilidad de la decisión geográfica). */
  geocode?: {
    queryUsed: string;
    displayName: string;
    class?: string;
    type?: string;
    placeRank?: number;
    importance?: number;
    score: number;
    scoreReasons: string[];
    center: { lat: number; lon: number };
    radiusKm: number;
    dimensionsKm: { heightKm: number; widthKm: number };
    consideredVariants: string[];
  };
  /** Qué instancia de Overpass respondió y cómo fue cada intento. */
  overpass?: {
    endpoint?: string;
    durationMs: number;
    attempts: { endpoint: string; durationMs: number; status?: number; error?: string; outcome: string }[];
  };
}

/* ------------------------------------------------------------------ */
/* Normalización y quality gate                                        */
/* ------------------------------------------------------------------ */

function firstTag(tags: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = tags[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function buildAddress(tags: Record<string, string>): string | undefined {
  const street = firstTag(tags, ["addr:street"]);
  const number = firstTag(tags, ["addr:housenumber"]);
  const parts = [street, number].filter(Boolean).join(" ");
  return parts || undefined;
}

/** Convierte un elemento de OSM en candidato (sin decidir todavía). */
export function candidateFromOsm(
  element: OverpassElement,
  category: CommercialCategory,
  areaName: string,
  discoveredAt: string,
): LeadCandidate {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  return {
    source: "openstreetmap",
    sourceId: osmPlaceId({ osm_type: element.type, osm_id: element.id }),
    sourceUrl: "https://www.openstreetmap.org/" + element.type + "/" + element.id,
    name: firstTag(tags, ["name"]) || "",
    categoryId: category.id,
    categoryLabel: category.label,
    osmTags: categoryTags(category),
    address: buildAddress(tags),
    city: firstTag(tags, ["addr:city"]),
    province: firstTag(tags, ["addr:province", "addr:state"]),
    country: firstTag(tags, ["addr:country"]),
    coordinates:
      typeof lat === "number" && typeof lon === "number" ? { lat, lon } : undefined,
    phone: firstTag(tags, ["phone", "contact:phone", "contact:mobile"]),
    email: firstTag(tags, ["email", "contact:email"]),
    website: firstTag(tags, ["website", "contact:website", "url"]),
    openingHours: firstTag(tags, ["opening_hours"]),
    brand: firstTag(tags, ["brand"]),
    operator: firstTag(tags, ["operator"]),
    socialLinks: {
      instagram: firstTag(tags, ["contact:instagram", "instagram"]),
      facebook: firstTag(tags, ["contact:facebook", "facebook"]),
    },
    rawTags: tags,
    discoveredAt,
    quality: { score: 0, tier: "candidate_rejected", reasons: [], notes: [] },
    classification: "candidate_rejected",
    reason: "weak_identity",
  };
}

/**
 * Quality gate determinista.
 *
 * REQUERIDO (identidad): nombre real + categoría comercial + ubicación
 * suficientemente identificable (coordenadas, dirección o ciudad).
 * BONUS: teléfono, sitio, email, dirección con número, horarios.
 *
 * Un negocio sin sitio web NO se rechaza: puede ser justamente la oportunidad.
 */
export function scoreLeadQuality(
  candidate: Pick<
    LeadCandidate,
    "name" | "categoryId" | "address" | "city" | "coordinates" | "phone" | "email" | "website" | "openingHours"
  >,
  areaName: string,
): LeadQuality {
  const reasons: CandidateReason[] = [];
  const notes: string[] = [];
  const normalizedName = normalizeIdentityText(candidate.name);
  const numericOnly = /^[0-9\s-]+$/.test(candidate.name.trim());

  if (!normalizedName) reasons.push("missing_name");
  else if (normalizedName.replace(/[^a-z]/g, "").length < 3 || numericOnly) {
    reasons.push("missing_name");
    notes.push("El nombre no parece un nombre comercial.");
  }
  if (!candidate.categoryId) reasons.push("missing_category");
  const hasLocation = Boolean(candidate.coordinates || candidate.address || candidate.city || areaName);
  if (!hasLocation) reasons.push("missing_location");

  if (reasons.length) {
    return { score: 0, tier: "candidate_rejected", reasons, notes };
  }

  let score = 30 + 20; // nombre + categoría presentes
  if (candidate.coordinates) {
    score += 15;
    notes.push("Tiene coordenadas.");
  }
  if (candidate.address) {
    score += 10;
    if (/\d/.test(candidate.address)) score += 5;
  } else if (candidate.city) {
    score += 5;
  }
  if (candidate.phone) {
    score += 10;
    notes.push("Tiene teléfono publicado.");
  }
  if (candidate.website) {
    score += 8;
    notes.push("Tiene sitio web publicado.");
  }
  if (candidate.email) score += 5;
  if (candidate.openingHours) score += 2;

  const weakIdentity =
    normalizedName.replace(/[^a-z]/g, "").length < 4 && !candidate.coordinates && !candidate.address;
  const tier: CandidateClassification = weakIdentity ? "candidate_ambiguous" : "lead_accepted";
  if (weakIdentity) notes.push("Identidad débil: nombre muy corto y sin dirección ni coordenadas.");

  return {
    score: Math.min(100, score),
    tier,
    reasons: [weakIdentity ? "weak_identity" : "accepted"],
    notes,
  };
}

/* ------------------------------------------------------------------ */
/* Deduplicación                                                       */
/* ------------------------------------------------------------------ */

export interface DedupeReport {
  candidates: LeadCandidate[];
  duplicatesAvoided: number;
  identityConflicts: number;
}

/**
 * Deduplica contra los prospectos existentes y dentro del propio lote.
 * Nunca fusiona automáticamente: los conflictos de identidad quedan como
 * `candidate_ambiguous`.
 */
export function dedupeCandidates(
  candidates: LeadCandidate[],
  existing: LeadItem[],
): DedupeReport {
  const bySourceId = new Map(existing.map((lead) => [lead.place_id, lead]));
  const byIdentity = new Map<string, LeadItem>();
  for (const lead of existing) {
    if (lead.identity) byIdentity.set(lead.identity, lead);
  }

  const seenSourceIds = new Set<string>();
  const seenIdentities = new Set<string>();
  const result: LeadCandidate[] = [];
  let duplicatesAvoided = 0;
  let identityConflicts = 0;

  for (const candidate of candidates) {
    if (seenSourceIds.has(candidate.sourceId)) {
      duplicatesAvoided += 1;
      result.push({
        ...candidate,
        quality: candidate.quality,
        classification: "candidate_rejected",
        reason: "duplicate",
        duplicateOf: candidate.sourceId,
      });
      continue;
    }
    const identity = leadIdentity({
      nombre: candidate.name,
      direccion: [candidate.address, candidate.city].filter(Boolean).join(", "),
      lat: candidate.coordinates?.lat,
      lon: candidate.coordinates?.lon,
    });
    if (seenIdentities.has(identity)) {
      duplicatesAvoided += 1;
      result.push({
        ...candidate,
        classification: "candidate_rejected",
        reason: "duplicate",
      });
      continue;
    }

    const exact = bySourceId.get(candidate.sourceId);
    if (exact) {
      duplicatesAvoided += 1;
      result.push({
        ...candidate,
        classification: "candidate_rejected",
        reason: "duplicate",
        duplicateOf: exact.place_id,
      });
      continue;
    }

    let conflicted = false;
    for (const lead of existing) {
      const verdict = matchBusinessIdentity(
        {
          nombre: lead.nombre,
          direccion: lead.direccion,
          zona: lead.zona,
          telefono: lead.telefono,
          website: lead.website,
          lat: undefined,
          lon: undefined,
        },
        {
          nombre: candidate.name,
          direccion: [candidate.address, candidate.city].filter(Boolean).join(", "),
          telefono: candidate.phone,
          website: candidate.website,
          lat: candidate.coordinates?.lat,
          lon: candidate.coordinates?.lon,
        },
      );
      if (verdict.status === "matched" || verdict.status === "probable") {
        conflicted = true;
        duplicatesAvoided += 1;
        result.push({
          ...candidate,
          classification: "candidate_rejected",
          reason: "duplicate",
          duplicateOf: lead.place_id,
        });
        break;
      }
      if (verdict.status === "ambiguous") {
        conflicted = true;
        identityConflicts += 1;
        result.push({
          ...candidate,
          classification: "candidate_ambiguous",
          reason: "identity_conflict",
          duplicateOf: lead.place_id,
        });
        break;
      }
    }
    if (conflicted) continue;

    seenSourceIds.add(candidate.sourceId);
    seenIdentities.add(identity);
    result.push(candidate);
  }

  return { candidates: result, duplicatesAvoided, identityConflicts };
}

/* ------------------------------------------------------------------ */
/* Orquestador                                                         */
/* ------------------------------------------------------------------ */

export interface DiscoverLeadsOptions {
  location: string;
  category: CommercialCategory;
  max?: number;
  /** Radio de la ventana de descubrimiento, en kilómetros (5/10/20/25). */
  radiusKm?: number;
  timeoutMs?: number;
  /** Inyectable para tests: evita consumir servicios reales. */
  requestImpl?: typeof fetchWithRetry;
}

/** Descubre negocios de una categoría en una zona. NO persiste nada. */
export async function discoverLeads(options: DiscoverLeadsOptions): Promise<DiscoveryResult> {
  const started = Date.now();
  const max = Math.max(1, Math.min(options.max ?? 20, CANDIDATE_DISCOVERED_LIMIT));
  const metrics: DiscoveryMetrics = {
    candidatesFound: 0,
    candidatesRejected: 0,
    candidatesAmbiguous: 0,
    leadsCreated: 0,
    duplicatesAvoided: 0,
    requestsBySource: { nominatim: 0, overpass: 0 },
    durationBySource: {},
    searxngQueries: 0,
    costNote: "Fuentes gratuitas: OpenStreetMap/Overpass + Nominatim. Costo externo $0.",
  };
  const errors: string[] = [];

  const geoStarted = Date.now();
  const geocoded = await geocodeArea(options.location, {
    timeoutMs: options.timeoutMs,
    requestImpl: options.requestImpl,
  });
  metrics.requestsBySource.nominatim = 1;
  metrics.durationBySource.nominatim = Date.now() - geoStarted;
  if (!geocoded.ok || !geocoded.area) {
    return {
      areaName: options.location,
      categoryId: options.category.id,
      categoryLabel: options.category.label,
      boundingBox: { south: 0, west: 0, north: 0, east: 0 },
      candidates: [],
      metrics,
      errors: [geocoded.error || "No se pudo resolver la zona indicada."],
    };
  }

  // Se busca dentro de una ventana acotada alrededor del centro de la
  // localidad: no se envía el bbox administrativo completo (departamento o
  // municipio entero), que satura la instancia pública y devuelve timeouts.
  const area = geocoded.area;
  const areaLabel = area.displayName;
  const center = {
    lat: area.lat ?? (area.boundingBox.south + area.boundingBox.north) / 2,
    lon: area.lon ?? (area.boundingBox.west + area.boundingBox.east) / 2,
  };
  const requestedRadius = options.radiusKm ?? DEFAULT_RADIUS_KM;
  const radiusKm = ALLOWED_RADIUS_KM.includes(requestedRadius) ? requestedRadius : DEFAULT_RADIUS_KM;
  const window = radiusBoundingBox(center, radiusKm);
  const query = buildCategoryQuery(options.category.tags, window, max * 3);
  const outcome = await queryOverpass(query, {
    timeoutMs: options.timeoutMs,
    requestImpl: options.requestImpl,
  });
  metrics.requestsBySource.overpass = outcome.attempts.length || 1;
  metrics.durationBySource.overpass = outcome.durationMs;
  if (!outcome.ok && !errors.includes(outcome.error || "")) {
    errors.push(outcome.error || "Overpass no respondió.");
  }
  // Se informa siempre, también cuando no hay comercios o Overpass falla.
  const trace: Pick<DiscoveryResult, "geocode" | "overpass"> = {
    geocode: {
      queryUsed: area.queryUsed,
      displayName: area.displayName,
      class: area.class,
      type: area.type,
      placeRank: area.placeRank,
      importance: area.importance,
      score: area.score,
      scoreReasons: area.scoreReasons,
      center,
      radiusKm,
      dimensionsKm: bboxDimensions(window),
      consideredVariants: geocoded.considered || [],
    },
    overpass: {
      endpoint: outcome.endpoint,
      durationMs: outcome.durationMs,
      attempts: outcome.attempts,
    },
  };
  if (!outcome.elements.length) {
    return {
      areaName: areaLabel,
      categoryId: options.category.id,
      categoryLabel: options.category.label,
      boundingBox: window,
      candidates: [],
      metrics,
      errors: errors.length ? errors : ["Overpass no devolvió negocios para esa zona y categoría."],
      ...trace,
    };
  }
  if (!outcome.ok) errors.push(outcome.error || "Overpass no respondió.");

  const discoveredAt = new Date().toISOString();
  const built: LeadCandidate[] = [];
  for (const element of outcome.elements) {
    const candidate = candidateFromOsm(element, options.category, areaLabel, discoveredAt);
    const quality = scoreLeadQuality(candidate, areaLabel);
    built.push({
      ...candidate,
      quality,
      classification: quality.tier,
      reason: quality.reasons[0] || "weak_identity",
    });
  }
  metrics.candidatesFound = built.length;

  const existing = getLeads();
  const deduped = dedupeCandidates(built, existing);
  metrics.duplicatesAvoided = deduped.duplicatesAvoided;

  const limited = deduped.candidates.slice(0, max * 2);
  for (const candidate of limited) {
    if (candidate.classification === "lead_accepted") metrics.leadsCreated += 1;
    else if (candidate.classification === "candidate_ambiguous") metrics.candidatesAmbiguous += 1;
    else metrics.candidatesRejected += 1;
  }
  metrics.durationBySource.total = Date.now() - started;

  return {
    areaName: areaLabel,
    categoryId: options.category.id,
    categoryLabel: options.category.label,
    boundingBox: window,
    candidates: limited,
    metrics,
    errors,
    ...trace,
  };
}

/* ------------------------------------------------------------------ */
/* Importación explícita (acción humana)                               */
/* ------------------------------------------------------------------ */

/** Convierte un candidato aceptado en evidencia con su origen. */
export function candidateEvidence(candidate: LeadCandidate): LeadEvidence[] {
  const evidence: LeadEvidence[] = [
    makeEvidence({
      field: "name",
      status: "found",
      value: candidate.name,
      source: "openstreetmap",
      sourceUrl: candidate.sourceUrl,
    }),
    makeEvidence({
      field: "category",
      status: "found",
      value: candidate.categoryLabel,
      source: "openstreetmap",
      sourceUrl: candidate.sourceUrl,
    }),
  ];
  const push = (
    field: "address" | "phone" | "email" | "website" | "instagram" | "facebook",
    value?: string,
  ) => {
    if (!value) return;
    evidence.push(
      makeEvidence({ field, status: "found", value, source: "openstreetmap", sourceUrl: candidate.sourceUrl }),
    );
  };
  push("address", [candidate.address, candidate.city].filter(Boolean).join(", ") || undefined);
  push("phone", candidate.phone);
  push("email", candidate.email);
  push("website", candidate.website);
  push("instagram", candidate.socialLinks?.instagram);
  push("facebook", candidate.socialLinks?.facebook);
  evidence.push(
    makeEvidence({
      field: "rating",
      status: "not_found",
      source: "openstreetmap",
      sourceUrl: candidate.sourceUrl,
      notes: "OpenStreetMap no publica puntuaciones: no se estima ninguna.",
    }),
  );
  return evidence;
}

export function candidateToLead(candidate: LeadCandidate, areaName: string): LeadItem {
  const zona = areaName.split(",").slice(0, 2).join(",").trim();
  const lead: LeadItem = {
    place_id: candidate.sourceId,
    nombre: candidate.name,
    rubro: candidate.categoryLabel,
    zona,
    direccion: [candidate.address, candidate.city].filter(Boolean).join(", "),
    telefono: candidate.phone || "",
    website: candidate.website || "",
    email: candidate.email || "",
    types: candidate.osmTags.join("|"),
    status: "nuevo",
    batch: "descubrimiento: " + candidate.categoryLabel + " en " + zona,
    searchDate: candidate.discoveredAt,
    identity: leadIdentity({
      nombre: candidate.name,
      direccion: [candidate.address, candidate.city].filter(Boolean).join(", "),
      zona,
      lat: candidate.coordinates?.lat,
      lon: candidate.coordinates?.lon,
    }),
    evidence: candidateEvidence(candidate),
    whatsappLink: "",
  };
  return lead;
}

/**
 * Importa candidatos elegidos explícitamente. Es la única función que escribe
 * en el CRM, y solo se llama con una selección humana.
 */
export function importCandidates(
  candidates: LeadCandidate[],
  areaName: string,
): { imported: string[]; skipped: number } {
  const importable = candidates.filter(
    (candidate) => candidate.classification === "lead_accepted",
  );
  if (!importable.length) return { imported: [], skipped: candidates.length };
  const existing = getLeads();
  const leads = importable.map((candidate) => candidateToLead(candidate, areaName));
  const merged = mergeLeadSearch(existing, leads, "accumulate");
  saveLeads(merged);
  return {
    imported: importable.map((candidate) => candidate.sourceId),
    skipped: candidates.length - importable.length,
  };
}
