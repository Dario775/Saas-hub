import { enrichLead } from "./lead-enrichment";
import type { EnrichmentFetcher } from "./lead-enrichment";
import {
  DEFAULT_EVALUATED_FIELDS,
  evidenceCoverage,
  fieldStatus,
  makeEvidence,
  mergeEvidence,
  supportedValues,
} from "./lead-evidence";
import type { EvidenceField, LeadEvidence } from "./lead-evidence";
import {
  identityStatusToEvidence,
  matchBusinessIdentity,
  matchSearchResult,
  subjectIdentity,
} from "./identity-match";
import type { IdentityMatchResult } from "./identity-match";
import { normalizeIdentityText } from "./lead-identity";
import { placesConfigured, searchPlaces } from "./google-places";
import type { PlacesCandidate } from "./google-places";
import { buildDiscoveryQueries, resolveWebSearchProvider, searchWeb } from "./web-search";
import type { WebSearchItem, WebSearchProvider } from "./web-search";
import type {
  BusinessDossier,
  DiscoverySummary,
  DossierGoogleBlock,
  DossierWebsiteBlock,
  IdentityMatchSummary,
} from "./opportunity-types";

/**
 * Digital Business Discovery.
 *
 * Construye el dossier digital de UN negocio antes de que decida Jev, usando
 * solo fuentes públicas y verificables: los datos que ya tenía el prospecto,
 * Google Places (si está configurado), el sitio web declarado y, si el
 * operador configuró un proveedor, búsqueda web.
 *
 * No llama a Jev, no llama a DeepSeek y no contacta al negocio. Nunca inventa
 * datos: lo que no se pudo comprobar queda como no buscado, no encontrado o
 * conflictivo, según corresponda.
 */

/** El dossier se reutiliza mientras siga fresco. Documentado y ajustable. */
export const DISCOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface DiscoveryLeadLike {
  place_id: string;
  nombre?: string;
  rubro?: string;
  zona?: string;
  direccion?: string;
  website?: string;
  telefono?: string;
  email?: string;
  rating?: string | number;
  lat?: string | number;
  lon?: string | number;
  evidence?: LeadEvidence[];
  dossier?: BusinessDossier | null;
}

export interface DiscoveryOptions {
  forceRefresh?: boolean;
  /** Máximo de consultas a la búsqueda web por negocio. */
  maxWebSearchQueries?: number;
  skipWebsite?: boolean;
  skipGoogle?: boolean;
  skipWebSearch?: boolean;
  googlePlacesKey?: string;
  webSearchProvider?: WebSearchProvider | null;
  fetchImpl?: EnrichmentFetcher;
  now?: () => Date;
  ttlMs?: number;
  timeoutMs?: number;
  /** Fuentes que ya estaban disponibles antes (para el historial del dossier). */
  consultedSources?: string[];
}

export interface DiscoveryResult {
  dossier: BusinessDossier;
  evidence: LeadEvidence[];
  summary: DiscoverySummary;
  cacheHit: boolean;
}

/* ------------------------------------------------------------------ */
/* Evidencia derivada de los datos que ya tenía el prospecto            */
/* ------------------------------------------------------------------ */

function leadRecordEvidence(lead: DiscoveryLeadLike): LeadEvidence[] {
  const evidence: LeadEvidence[] = [];
  const push = (field: EvidenceField, value?: string | number) => {
    if (!value) return;
    evidence.push(
      makeEvidence({
        field,
        status: "found",
        value,
        source: "derived",
        confidence: 0.8,
        notes: "Dato ya presente en el prospecto; el origen original no está registrado.",
      }),
    );
  };
  push("name", lead.nombre);
  push("category", lead.rubro);
  push("address", lead.direccion);
  push("phone", lead.telefono);
  push("email", lead.email);
  push("website", lead.website);
  return evidence;
}

/* ------------------------------------------------------------------ */
/* Google Places                                                       */
/* ------------------------------------------------------------------ */

function placesEvidence(candidate: PlacesCandidate, match: IdentityMatchResult): LeadEvidence[] {
  const sourceUrl = candidate.mapsUri || undefined;
  const evidence: LeadEvidence[] = [
    makeEvidence({
      field: "identity",
      status: identityStatusToEvidence(match.status),
      value: candidate.name,
      source: "google_places",
      sourceUrl,
      notes: match.matchedSignals.length
        ? `Señales coincidentes: ${match.matchedSignals.join(", ")} (puntaje ${match.score})`
        : `Sin señales coincidentes (puntaje ${match.score})`,
    }),
  ];
  const add = (field: EvidenceField, value?: string | number | null) => {
    if (value === undefined || value === null || value === "") return;
    evidence.push(
      makeEvidence({ field, status: "found", value, source: "google_places", sourceUrl }),
    );
  };
  add("name", candidate.name);
  add("address", candidate.address);
  add("phone", candidate.phone);
  add("website", candidate.website);
  add("category", candidate.primaryType);
  // La puntuación solo se registra si Google la informa: nunca se estima.
  add("rating", candidate.rating);
  return evidence;
}

function summarizeMatch(
  match: IdentityMatchResult,
  candidate: PlacesCandidate,
): IdentityMatchSummary {
  return {
    status: match.status,
    confidence: match.confidence,
    score: match.score,
    candidateName: candidate.name,
    candidateSource: "google_places",
    candidateUrl: candidate.mapsUri,
    matchedSignals: match.matchedSignals,
    conflictingSignals: match.conflictingSignals,
  };
}

async function googleDiscovery(
  lead: DiscoveryLeadLike,
  options: DiscoveryOptions,
  evidence: LeadEvidence[],
): Promise<{
  google?: DossierGoogleBlock;
  identity?: IdentityMatchSummary | null;
  conflicts: string[];
  error?: string;
  ok: boolean;
}> {
  const conflicts: string[] = [];
  if (!placesConfigured(options.googlePlacesKey)) {
    return {
      ok: false,
      error: "Google Places no está configurado (falta GOOGLE_PLACES_KEY).",
      conflicts,
    };
  }

  const query = [lead.nombre, lead.direccion || lead.zona]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(" ")
    .trim();
  if (!query) {
    return { ok: false, error: "El prospecto no tiene nombre ni zona para consultar.", conflicts };
  }

  const result = await searchPlaces({
    apiKey: options.googlePlacesKey,
    query,
    lat: lead.lat,
    lon: lead.lon,
    maxResults: 5,
    timeoutMs: options.timeoutMs,
  });

  if (!result.ok) {
    return { ok: false, error: result.error || "Google Places no devolvió resultados.", conflicts };
  }

  const ranked = result.candidates
    .map((candidate) => ({
      candidate,
      match: matchBusinessIdentity(
        {
          nombre: lead.nombre,
          direccion: lead.direccion,
          zona: lead.zona,
          telefono: lead.telefono,
          website: lead.website,
          rubro: lead.rubro,
          lat: lead.lat,
          lon: lead.lon,
        },
        {
          nombre: candidate.name,
          direccion: candidate.address,
          zona: lead.zona,
          telefono: candidate.phone,
          website: candidate.website,
          rubro: candidate.primaryType,
          lat: candidate.lat,
          lon: candidate.lon,
        },
      ),
    }))
    .sort((a, b) => b.match.score - a.match.score);

  const viable = ranked.filter(
    (item) => item.match.status === "matched" || item.match.status === "probable",
  );
  const best = ranked[0];
  const google: DossierGoogleBlock = { candidatesFound: result.candidates.length };

  if (!best) {
    evidence.push(
      makeEvidence({
        field: "identity",
        status: "not_found",
        source: "google_places",
        notes: "Google Places no devolvió resultados para la consulta. No se encontró coincidencia.",
      }),
    );
    return { ok: true, google, identity: null, conflicts };
  }

  if (viable.length === 1) {
    const chosen = viable[0];
    const identity = summarizeMatch(chosen.match, chosen.candidate);
    evidence.push(...placesEvidence(chosen.candidate, chosen.match));
    google.placeId = chosen.candidate.placeId;
    google.matchedPlaceId = chosen.candidate.placeId;
    google.rating = chosen.candidate.rating;
    google.ratingCount = chosen.candidate.ratingCount;
    google.businessStatus = chosen.candidate.businessStatus;
    google.primaryType = chosen.candidate.primaryType;
    google.mapsUri = chosen.candidate.mapsUri;
    return { ok: true, google, identity, conflicts };
  }

  if (viable.length > 1) {
    // Ambigüedad: NO se fusiona nada automáticamente.
    const names = viable.map((item) => item.candidate.name).join(", ");
    evidence.push(
      makeEvidence({
        field: "identity",
        status: "conflicting",
        source: "google_places",
        notes: `${viable.length} candidatos plausibles en Google Places (${names}). No se fusionó automáticamente.`,
      }),
    );
    conflicts.push(`Google Places: ${viable.length} candidatos plausibles`);
    return {
      ok: true,
      google,
      identity: {
        ...summarizeMatch(viable[0].match, viable[0].candidate),
        status: "ambiguous",
      },
      conflicts,
    };
  }

  evidence.push(
    makeEvidence({
      field: "identity",
      status: "not_found",
      source: "google_places",
      notes: `Ninguno de los ${result.candidates.length} resultados de Google Places superó el umbral de coincidencia.`,
    }),
  );
  return {
    ok: true,
    google,
    identity: summarizeMatch(best.match, best.candidate),
    conflicts,
  };
}

/* ------------------------------------------------------------------ */
/* Búsqueda web (opcional)                                             */
/* ------------------------------------------------------------------ */

const SOCIAL_HOSTS: { host: string; field: EvidenceField }[] = [
  { host: "instagram.com", field: "instagram" },
  { host: "facebook.com", field: "facebook" },
  { host: "fb.com", field: "facebook" },
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function socialFieldFor(url: string): EvidenceField {
  const host = hostOf(url);
  const known = SOCIAL_HOSTS.find((item) => host.endsWith(item.host));
  return known ? known.field : "social";
}

/**
 * Directorios y marketplaces: NUNCA son el sitio oficial de un comercio.
 * Solo pueden aportar datos secundarios del resumen, y solo si la identidad
 * correlaciona.
 */
const DIRECTORY_HOSTS = [
  "paginasamarillas",
  "abctelefonos",
  "telexplorer",
  "cylex",
  "yelp",
  "tripadvisor",
  "foursquare",
  "guia",
  "directorio",
  "mercadolibre",
  "mercadoshops",
  "tiendanube",
  "shopify",
  "wikipedia",
  "dateas",
  "empresite",
  "informacion-empresas",
];

/** Dominios que nunca son el sitio oficial de un comercio. */
const SITE_HOST_BLOCKLIST = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "youtube",
  "twitter",
  "whatsapp",
  "mercadolibre",
  "tiendanube",
  "shopify",
  "wixsite",
  "blogspot",
  "wordpress.com",
  "google",
  "maps",
];

/**
 * Candidato a sitio oficial por búsqueda web.
 * Regla determinista: el dominio (sin www ni separadores) debe contener al
 * menos la mitad de las palabras significativas del nombre del negocio, y no
 * puede ser un dominio de red social, marketplace o plataforma genérica.
 * Es un candidato: se registra como "found" con confianza reducida, nunca
 * como verificado.
 */
export function officialSiteCandidate(
  businessName: string | undefined,
  items: WebSearchItem[],
): WebSearchItem | undefined {
  const tokens = normalizeIdentityText(businessName)
    .split(" ")
    .filter((token) => token.length >= 4);
  if (!tokens.length) return undefined;
  for (const item of items) {
    const host = hostOf(item.url);
    if (!host) continue;
    if (SITE_HOST_BLOCKLIST.some((blocked) => host.includes(blocked))) continue;
    const compact = host.replace(/[^a-z0-9]+/g, "");
    if (!compact) continue;
    const matched = tokens.filter((token) => compact.includes(token));
    if (matched.length >= 1 && matched.length / tokens.length >= 0.5) return item;
  }
  return undefined;
}

function evidenceForSearchItem(
  lead: DiscoveryLeadLike,
  item: WebSearchItem,
  verdict: { status: string; confidence: number; matchedSignals: string[] },
  alreadyHasWebsite: boolean,
): LeadEvidence[] {
  const evidence: LeadEvidence[] = [];
  const host = hostOf(item.url);
  const isSocial = /instagram|facebook|tiktok|linkedin|youtube|fb\.com/i.test(host);
  const isDirectory = DIRECTORY_HOSTS.some((blocked) => host.includes(blocked));
  const reason = "Correlación: " + (verdict.matchedSignals.join(", ") || "sin señales");

  if (isSocial) {
    evidence.push(
      makeEvidence({
        field: socialFieldFor(item.url),
        status: "found",
        value: item.url,
        source: "web_search",
        sourceUrl: item.url,
        confidence: verdict.status === "matched" ? 0.85 : 0.7,
        notes: "Perfil público hallado por búsqueda web y correlacionado con el negocio. " + reason + ". No se verificó actividad del perfil.",
      }),
    );
    return evidence;
  }

  if (isDirectory) {
    // Nunca es sitio oficial: solo puede aportar datos secundarios del resumen.
    const snippet = item.snippet || "";
    const phoneMatch = snippet.match(/(?:\+?54[\s-]?9?[\s-]?)?(?:\d{2,4}[\s-]?){1,3}\d{4}/);
    if (phoneMatch) {
      evidence.push(
        makeEvidence({
          field: "phone",
          status: "found",
          value: phoneMatch[0].trim(),
          source: "web_search",
          sourceUrl: item.url,
          confidence: 0.5,
          notes: "Teléfono publicado en un directorio, correlacionado con el negocio. " + reason,
        }),
      );
    } else {
      evidence.push(
        makeEvidence({
          field: "social",
          status: "inferred",
          value: item.url,
          source: "web_search",
          sourceUrl: item.url,
          confidence: 0.4,
          notes: "Directorio o listado relacionado con el negocio (no es su sitio oficial). " + reason,
        }),
      );
    }
    return evidence;
  }

  if (!alreadyHasWebsite && officialSiteCandidate(lead.nombre, [item])) {
    evidence.push(
      makeEvidence({
        field: "website",
        status: "found",
        value: item.url,
        source: "web_search",
        sourceUrl: item.url,
        confidence: verdict.status === "matched" ? 0.75 : 0.6,
        notes: "Candidato a sitio oficial por búsqueda web, correlacionado con el negocio. " + reason,
      }),
    );
  }
  return evidence;
}

/* ------------------------------------------------------------------ */
/* Dossier                                                             */
/* ------------------------------------------------------------------ */

function bucketSocial(values: string[]): {
  instagram: string[];
  facebook: string[];
  tiktok: string[];
  linkedin: string[];
  youtube: string[];
} {
  const buckets = {
    instagram: [] as string[],
    facebook: [] as string[],
    tiktok: [] as string[],
    linkedin: [] as string[],
    youtube: [] as string[],
  };
  for (const value of values) {
    const host = hostOf(value);
    if (host.endsWith("instagram.com")) buckets.instagram.push(value);
    else if (host.endsWith("facebook.com") || host.endsWith("fb.com")) buckets.facebook.push(value);
    else if (host.endsWith("tiktok.com")) buckets.tiktok.push(value);
    else if (host.endsWith("linkedin.com")) buckets.linkedin.push(value);
    else if (host.endsWith("youtube.com") || host.endsWith("youtu.be")) buckets.youtube.push(value);
  }
  return buckets;
}

function buildDossier(input: {
  lead: DiscoveryLeadLike;
  evidence: LeadEvidence[];
  website: DossierWebsiteBlock;
  google?: DossierGoogleBlock;
  identity?: IdentityMatchSummary | null;
  sourcesConsulted: string[];
  sourcesUnavailable: { source: string; error: string }[];
  commerceMarkers: string[];
  generatedAt: string;
  ttlMs: number;
  coordinates?: { lat?: number; lon?: number };
}): BusinessDossier {
  const socialValues = [
    ...supportedValues(input.evidence, "instagram"),
    ...supportedValues(input.evidence, "facebook"),
    ...supportedValues(input.evidence, "social"),
  ];
  return {
    leadId: input.lead.place_id,
    identity: input.identity ?? null,
    business: {
      name: input.lead.nombre || "",
      category: input.lead.rubro || "",
      address: input.lead.direccion || "",
      coordinates: input.coordinates,
    },
    website: input.website,
    contacts: {
      phones: supportedValues(input.evidence, "phone"),
      whatsapp: supportedValues(input.evidence, "whatsapp"),
      emails: supportedValues(input.evidence, "email"),
      contactForms: supportedValues(input.evidence, "contact_form"),
    },
    social: bucketSocial([...new Set(socialValues)]),
    commerce: {
      ecommerce: fieldStatus(input.evidence, "ecommerce"),
      catalog: fieldStatus(input.evidence, "catalog"),
      markers: input.commerceMarkers,
    },
    google: input.google,
    evidence: input.evidence,
    sourcesConsulted: input.sourcesConsulted,
    sourcesUnavailable: input.sourcesUnavailable,
    coverage: evidenceCoverage(input.evidence, DEFAULT_EVALUATED_FIELDS),
    generatedAt: input.generatedAt,
    ttlMs: input.ttlMs,
  };
}

/* ------------------------------------------------------------------ */
/* Orquestador                                                         */
/* ------------------------------------------------------------------ */

export async function discoverBusinessPresence(
  lead: DiscoveryLeadLike,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const started = Date.now();
  const now = options.now ? options.now() : new Date();
  const ttlMs = options.ttlMs ?? DISCOVERY_TTL_MS;
  const sourcesAttempted: string[] = [];
  const sourcesSucceeded: string[] = [];
  const sourcesFailed: { source: string; error: string }[] = [];
  const sourcesSkipped: { source: string; reason: string }[] = [];
  const webSearchQueries: string[] = [];
  const searchStats = { queries: 0, evaluated: 0, accepted: 0, rejected: 0, ambiguous: 0 };
  const errors: string[] = [];

  const existingEvidence = lead.evidence || [];
  const coverageBefore = evidenceCoverage(existingEvidence, DEFAULT_EVALUATED_FIELDS);

  const cached = lead.dossier;
  if (!options.forceRefresh && cached && cached.generatedAt) {
    const age = now.getTime() - Date.parse(cached.generatedAt);
    if (Number.isFinite(age) && age >= 0 && age < (cached.ttlMs || ttlMs)) {
      return {
        dossier: cached,
        evidence: cached.evidence,
        cacheHit: true,
        summary: {
          cacheHit: true,
          durationMs: Date.now() - started,
          sourcesAttempted: ["cache"],
          sourcesSucceeded: ["cache"],
          sourcesFailed: [],
          sourcesSkipped: [],
          webSearchQueries: [],
          searchResults: { queries: 0, evaluated: 0, accepted: 0, rejected: 0, ambiguous: 0 },
          coverageBefore,
          coverageAfter: cached.coverage,
          identity: cached.identity ?? null,
          conflicts: [],
        },
      };
    }
  }

  let evidence = mergeEvidence(existingEvidence, leadRecordEvidence(lead));
  const conflicts: string[] = [];
  let identity: IdentityMatchSummary | null = null;
  let googleBlock: DossierGoogleBlock | undefined;

  // 1) Google Places: fuente OPCIONAL. Sin clave no es un fallo y no afecta
  // la cobertura: el descubrimiento es válido sin ella.
  if (!options.skipGoogle) {
    if (!placesConfigured(options.googlePlacesKey)) {
      sourcesSkipped.push({
        source: "google_places",
        reason: "Fuente opcional no configurada (sin GOOGLE_PLACES_KEY).",
      });
    } else {
      sourcesAttempted.push("google_places");
      const outcome = await googleDiscovery(lead, options, evidence);
      if (outcome.ok) sourcesSucceeded.push("google_places");
      else if (outcome.error) sourcesFailed.push({ source: "google_places", error: outcome.error });
      googleBlock = outcome.google;
      identity = outcome.identity ?? identity;
      conflicts.push(...outcome.conflicts);
    }
  }

  // 2) Búsqueda web opcional: pocas consultas orientadas a identidad y, sobre
  // todo, ningún resultado se convierte en dato sin correlacionar primero.
  const provider =
    options.webSearchProvider === undefined
      ? resolveWebSearchProvider()
      : options.webSearchProvider;
  if (!options.skipWebSearch && provider) {
    sourcesAttempted.push("web_search");
    const planned = buildDiscoveryQueries(lead, options.maxWebSearchQueries ?? 4);
    const seenUrls = new Set<string>();
    const collected: WebSearchItem[] = [];
    let queriesOk = 0;
    let lastError = "";
    for (const request of planned) {
      webSearchQueries.push(request.query);
      searchStats.queries += 1;
      const outcome = await searchWeb(request.query, {
        provider,
        limit: 6,
        timeoutMs: options.timeoutMs,
      });
      if (!outcome.ok) {
        lastError = outcome.error || "sin resultados";
        continue;
      }
      queriesOk += 1;
      for (const item of outcome.items) {
        if (!item.url || seenUrls.has(item.url)) continue;
        seenUrls.add(item.url);
        collected.push(item);
      }
    }
    if (queriesOk > 0) sourcesSucceeded.push("web_search");
    else if (lastError) sourcesFailed.push({ source: "web_search", error: lastError });

    const ambiguousUrls: string[] = [];
    for (const item of collected) {
      const verdict = matchSearchResult(
        {
          nombre: lead.nombre,
          direccion: lead.direccion,
          zona: lead.zona,
          telefono: lead.telefono,
          website: lead.website,
          rubro: lead.rubro,
        },
        item,
      );
      searchStats.evaluated += 1;
      if (verdict.accepted) {
        searchStats.accepted += 1;
        const alreadyHasWebsite = supportedValues(evidence, "website").length > 0;
        evidence = mergeEvidence(
          evidence,
          evidenceForSearchItem(lead, item, verdict, alreadyHasWebsite),
        );
      } else if (verdict.status === "ambiguous") {
        searchStats.ambiguous += 1;
        ambiguousUrls.push(item.url);
      } else {
        searchStats.rejected += 1;
      }
    }

    if (ambiguousUrls.length) {
      // Nunca se fusiona un candidato ambiguo: solo se deja constancia.
      evidence = mergeEvidence(evidence, [
        makeEvidence({
          field: "identity",
          status: "conflicting",
          source: "web_search",
          notes:
            ambiguousUrls.length +
            " resultado(s) de búsqueda con identidad ambigua; no se fusionaron. Ejemplo: " +
            ambiguousUrls[0].slice(0, 90),
        }),
      ]);
      conflicts.push(
        "Búsqueda web: " + ambiguousUrls.length + " candidato(s) ambiguo(s), no fusionados",
      );
    }
  }

  // 3) Sitio web: validación y datos públicos.
  const websiteUrl = supportedValues(evidence, "website")[0];
  const websiteBlock: DossierWebsiteBlock = {
    status: fieldStatus(evidence, "website"),
    url: websiteUrl || undefined,
    checkedUrls: [],
  };

  if (!options.skipWebsite && websiteUrl) {
    sourcesAttempted.push("website");
    try {
      const enriched = await enrichLead({ ...lead, website: websiteUrl }, evidence, {
        fetchImpl: options.fetchImpl,
        maxPages: 3,
        timeoutMs: options.timeoutMs,
      });
      evidence = mergeEvidence(evidence, enriched.evidence);
      websiteBlock.checkedUrls = enriched.checkedUrls;
      websiteBlock.reachable = enriched.website.reachable;
      websiteBlock.finalUrl = enriched.website.finalUrl;
      websiteBlock.title = enriched.website.title;
      websiteBlock.description = enriched.website.description;
      websiteBlock.status = fieldStatus(evidence, "website");
      if (enriched.website.reachable) sourcesSucceeded.push("website");
      else
        sourcesFailed.push({
          source: "website",
          error: enriched.errors[0] || "El sitio declarado no respondió.",
        });
      errors.push(...enriched.errors);
    } catch (error) {
      sourcesFailed.push({
        source: "website",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 4) Campos que se pudieron comprobar y quedaron sin dato.
  const consulted = [...sourcesSucceeded];
  if (!fieldStatus(evidence, "website") || fieldStatus(evidence, "website") === "not_searched") {
    evidence = mergeEvidence(evidence, [
      consulted.length
        ? makeEvidence({
            field: "website",
            status: "not_found",
            source: "derived",
            notes: `No se encontró sitio web en las fuentes consultadas (${consulted.join(", ")}).`,
          })
        : makeEvidence({
            field: "website",
            status: "not_searched",
            source: "derived",
            notes: "No se consultó ninguna fuente que pueda aportar el sitio web.",
          }),
    ]);
  }

  const coverageAfter = evidenceCoverage(evidence, DEFAULT_EVALUATED_FIELDS);
  const generatedAt = now.toISOString();
  const dossier = buildDossier({
    lead,
    evidence,
    website: { ...websiteBlock, status: fieldStatus(evidence, "website") },
    google: googleBlock,
    identity,
    sourcesConsulted: [...new Set([...(options.consultedSources || []), ...sourcesSucceeded])],
    sourcesUnavailable: sourcesFailed,
    commerceMarkers: evidence
      .filter((item) => (item.field === "ecommerce" || item.field === "catalog") && item.notes)
      .flatMap((item) => (item.notes || "").split(":").slice(1).join(":").split(","))
      .map((marker) => marker.trim())
      .filter(Boolean)
      .slice(0, 10),
    generatedAt,
    ttlMs,
    coordinates:
      lead.lat !== undefined && lead.lon !== undefined
        ? {
            lat: typeof lead.lat === "number" ? lead.lat : Number.parseFloat(String(lead.lat)),
            lon: typeof lead.lon === "number" ? lead.lon : Number.parseFloat(String(lead.lon)),
          }
        : undefined,
  });

  return {
    dossier,
    evidence,
    cacheHit: false,
    summary: {
      cacheHit: false,
      durationMs: Date.now() - started,
      sourcesAttempted,
      sourcesSucceeded,
      sourcesFailed,
      sourcesSkipped,
      webSearchQueries,
      searchResults: searchStats,
      coverageBefore,
      coverageAfter,
      identity,
      conflicts,
    },
  };
}

/** Identidad propia del prospecto (para trazabilidad en el registro). */
export function discoveryIdentity(lead: DiscoveryLeadLike): string {
  return subjectIdentity({
    nombre: lead.nombre,
    direccion: lead.direccion,
    zona: lead.zona,
    lat: lead.lat,
    lon: lead.lon,
  });
}
