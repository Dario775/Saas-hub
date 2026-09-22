import { fetchPublic } from "./public-fetch";
import type { EvidenceField, LeadEvidence } from "./lead-evidence";
import { makeEvidence } from "./lead-evidence";
import type { EnrichmentSummary } from "./opportunity-types";

/**
 * Enriquecimiento de UN prospecto a partir de fuentes públicas.
 *
 * Reglas de esta fase: nada de crawling masivo, nada de evadir bloqueos,
 * nada de sesiones ni cuentas. Solo se consulta el sitio que el prospecto
 * ya declara (máximo 3 páginas), con timeout y límite de tamaño de
 * `public-fetch`, que además bloquea direcciones privadas.
 */

export type EnrichmentFetcher = (
  url: string,
  maxBytes?: number,
  redirects?: number,
) => Promise<{ body: Buffer; contentType: string; finalUrl?: string }>;

export interface EnrichmentFindings {
  emails: string[];
  phones: string[];
  instagram: string[];
  facebook: string[];
  whatsapp: string[];
  otherSocial: string[];
  ecommerce: boolean;
  catalog: boolean;
  contactForm: boolean;
  commerceMarkers: string[];
  structuredDataTypes: string[];
}

export interface EnrichmentWebsiteInfo {
  reachable: boolean;
  finalUrl?: string;
  title?: string;
  description?: string;
  checkedUrls: string[];
}

export interface LeadEnrichmentResult extends EnrichmentSummary {
  findings: EnrichmentFindings;
  pagesFetched: string[];
  /** Evidencia nueva aportada por el enriquecimiento (no reemplaza la anterior). */
  evidence: LeadEvidence[];
  /** Datos de presentación del sitio, para el dossier. */
  website: EnrichmentWebsiteInfo;
}

export interface EnrichmentOptions {
  /** Si es true no se hace ninguna petición de red (solo se marca lo no consultado). */
  skipFetch?: boolean;
  /** Máximo de páginas por prospecto (home + rutas de contacto). */
  maxPages?: number;
  maxBytes?: number;
  /** Presupuesto total para este prospecto. */
  deadlineMs?: number;
  /** Alias de deadlineMs, usado por Business Discovery. */
  timeoutMs?: number;
  fetchImpl?: EnrichmentFetcher;
  consultedSources?: string[];
  pauseMs?: number;
}

export interface EnrichmentLeadLike {
  nombre?: string;
  rubro?: string;
  zona?: string;
  website?: string;
  telefono?: string;
  email?: string;
}

const EMAIL_JUNK = [
  "example.com",
  "sentry.io",
  "wixpress",
  "godaddy",
  "domain.com",
  "your@",
  "name@",
  "mail@mail",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  "@2x",
  "@3x",
];

const CONTACT_ROUTES = ["", "/contacto", "/contact", "/nosotros"];

const ECOMMERCE_MARKERS = [
  "add-to-cart",
  "add_to_cart",
  "carrito",
  "woocommerce",
  "shopify",
  "tiendanube",
  "mercado shops",
  "mercadolibre",
  "prestashop",
  "checkout",
  "comprar ahora",
  "agregar al carrito",
];

const CATALOG_MARKERS = [
  "catálogo",
  "catalogo",
  "catalog",
  "productos",
  "/productos",
  "/catalogo",
  "precio",
  "medios de pago",
];

const SOCIAL_PATTERNS: { field: EvidenceField; pattern: RegExp }[] = [
  { field: "instagram", pattern: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\/-]{2,60}/gi },
  { field: "facebook", pattern: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\/-]{2,80}/gi },
  { field: "whatsapp", pattern: /https?:\/\/(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\/[A-Za-z0-9_.?=&%\/-]{4,120}/gi },
];

const OTHER_SOCIAL_PATTERN =
  /https?:\/\/(?:www\.)?(?:tiktok\.com|linkedin\.com|youtube\.com|youtu\.be|x\.com|twitter\.com)\/[A-Za-z0-9_.\/?=&%-]{2,80}/gi;

/** Normaliza un sitio declarado a una URL http(s) utilizable. */
export function normalizeWebsiteUrl(raw?: string | null): string {
  const value = (raw || "").trim();
  if (!value) return "";
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (!url.hostname.includes(".")) return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function extractEmails(html: string): string[] {
  const matches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const clean = new Set<string>();
  for (const raw of matches) {
    const email = raw.trim().toLowerCase();
    if (email.length > 80) continue;
    if (EMAIL_JUNK.some((junk) => email.includes(junk))) continue;
    clean.add(email);
  }
  return [...clean];
}

export function extractSocialLinks(html: string): {
  instagram: string[];
  facebook: string[];
  whatsapp: string[];
  otherSocial: string[];
} {
  const pick = (pattern: RegExp) => {
    const found = html.match(pattern) || [];
    return [...new Set(found.map((item) => item.replace(/["'<>].*$/, "").replace(/\/$/, "")))].slice(0, 3);
  };
  return {
    instagram: pick(SOCIAL_PATTERNS[0].pattern),
    facebook: pick(SOCIAL_PATTERNS[1].pattern),
    whatsapp: pick(SOCIAL_PATTERNS[2].pattern),
    otherSocial: pick(OTHER_SOCIAL_PATTERN),
  };
}

/** Teléfonos publicados en enlaces tel: del sitio. */
export function extractPhones(html: string): string[] {
  const found = html.match(/href=["']tel:([^"']+)["']/gi) || [];
  const clean = new Set<string>();
  for (const raw of found) {
    const value = raw.replace(/^href=["']tel:/i, "").replace(/["']$/, "").trim();
    if (value) clean.add(value);
  }
  return [...clean];
}

export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i);
  const value = match ? match[1].replace(/\s+/g, " ").trim() : "";
  return value || undefined;
}

export function extractDescription(html: string): string | undefined {
  const match =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,300})["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']{0,300})["'][^>]+name=["']description["']/i);
  const value = match ? match[1].replace(/\s+/g, " ").trim() : "";
  return value || undefined;
}

/** Tipos de datos estructurados (schema.org) presentes en la página. */
export function extractStructuredDataTypes(html: string): string[] {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]{0,4000}?<\/script>/gi) || [];
  const types = new Set<string>();
  for (const block of blocks) {
    const matches = block.match(/"@type"\s*:\s*"([A-Za-z]+)"/g) || [];
    for (const item of matches) {
      const type = item.split(":")[1]?.replace(/["\s]/g, "");
      if (type) types.add(type);
    }
  }
  return [...types].slice(0, 12);
}

export function detectCommerceSignals(html: string): {
  ecommerce: boolean;
  catalog: boolean;
  contactForm: boolean;
  markers: string[];
  structuredDataTypes: string[];
} {
  const lower = html.toLowerCase();
  const commerceMarkers = ECOMMERCE_MARKERS.filter((marker) => lower.includes(marker));
  const catalogMarkers = CATALOG_MARKERS.filter((marker) => lower.includes(marker));
  const structuredDataTypes = extractStructuredDataTypes(html);
  const structuredCommerce = structuredDataTypes.some((type) =>
    ["Product", "Offer", "AggregateOffer", "ItemList"].includes(type),
  );
  const structuredStore = structuredDataTypes.some((type) =>
    ["Store", "OnlineStore", "LocalBusiness"].includes(type),
  );
  const contactForm =
    /<form/i.test(html) && /(contacto|contact|escribinos|consulta)/i.test(html);
  return {
    ecommerce: commerceMarkers.length > 0 || structuredCommerce,
    catalog: catalogMarkers.length > 0 || structuredDataTypes.includes("ItemList") || structuredStore,
    contactForm,
    markers: [...commerceMarkers, ...catalogMarkers, ...structuredDataTypes].slice(0, 10),
    structuredDataTypes,
  };
}

function emptyFindings(): EnrichmentFindings {
  return {
    emails: [],
    phones: [],
    instagram: [],
    facebook: [],
    whatsapp: [],
    otherSocial: [],
    ecommerce: false,
    catalog: false,
    contactForm: false,
    commerceMarkers: [],
    structuredDataTypes: [],
  };
}

/**
 * Enriquece un prospecto. No lanza: devuelve la evidencia encontrada y los
 * errores controlados, sin tocar los datos que ya existían.
 */
export async function enrichLead(
  lead: EnrichmentLeadLike,
  currentEvidence: LeadEvidence[] | undefined,
  options: EnrichmentOptions = {},
): Promise<LeadEnrichmentResult> {
  const consulted = options.consultedSources?.length
    ? options.consultedSources
    : currentEvidence?.length
      ? Array.from(new Set(currentEvidence.map((item) => item.source)))
      : ["openstreetmap"];
  const evidence: LeadEvidence[] = [];
  const errors: string[] = [];
  const pagesFetched: string[] = [];
  const checkedUrls: string[] = [];
  const findings = emptyFindings();
  const websiteUrl = normalizeWebsiteUrl(lead.website);
  const website: EnrichmentWebsiteInfo = { reachable: false, checkedUrls };

  if (options.skipFetch) {
    website.checkedUrls = checkedUrls;
    evidence.push(
      makeEvidence({
        field: "website",
        status: "not_searched",
        source: "derived",
        notes: "El enriquecimiento se ejecutó en modo local, sin consultar sitios.",
      }),
    );
    return {
      skipped: true,
      checkedUrls,
      pagesFetched,
      evidenceAdded: evidence.length,
      errors,
      findings,
      evidence,
      website,
    };
  }

  if (!websiteUrl) {
    website.checkedUrls = checkedUrls;
    evidence.push(
      makeEvidence({
        field: "website",
        status: "not_found",
        source: "derived",
        notes: `No se encontró sitio web declarado en las fuentes consultadas (${consulted.join(", ")}).`,
      }),
    );
    return {
      skipped: false,
      checkedUrls,
      pagesFetched,
      evidenceAdded: evidence.length,
      errors,
      findings,
      evidence,
      website,
    };
  }

  const deadline = Date.now() + (options.timeoutMs ?? options.deadlineMs ?? 25_000);
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 3, 4));
  const fetchImpl: EnrichmentFetcher = options.fetchImpl || fetchPublic;
  const pauseMs = options.pauseMs ?? 250;

  for (const route of CONTACT_ROUTES.slice(0, maxPages)) {
    if (Date.now() > deadline) {
      errors.push("Se alcanzó el tiempo máximo de enriquecimiento para este prospecto.");
      break;
    }
    const url = `${websiteUrl}${route}`;
    checkedUrls.push(url);
    try {
      const result = await fetchImpl(url, options.maxBytes ?? 1_500_000);
      const html = result.body.toString("utf8");
      pagesFetched.push(url);
      if (route === "") {
        website.reachable = true;
        website.finalUrl = result.finalUrl || url;
        website.title = extractTitle(html);
        website.description = extractDescription(html);
        evidence.push(
          makeEvidence({
            field: "website",
            status: "verified",
            value: website.finalUrl || websiteUrl,
            source: "website",
            sourceUrl: url,
            notes: "El sitio declarado respondió correctamente.",
          }),
        );
      }
      const socials = extractSocialLinks(html);
      const commerce = detectCommerceSignals(html);
      const emails = extractEmails(html);
      const phones = extractPhones(html);

      for (const [field, values] of [
        ["instagram", socials.instagram],
        ["facebook", socials.facebook],
        ["whatsapp", socials.whatsapp],
      ] as const) {
        for (const value of values) {
          evidence.push(
            makeEvidence({ field, status: "found", value, source: "website", sourceUrl: url }),
          );
          findings[field].push(value);
        }
      }
      for (const value of socials.otherSocial) {
        evidence.push(
          makeEvidence({
            field: "social",
            status: "found",
            value,
            source: "website",
            sourceUrl: url,
          }),
        );
        findings.otherSocial.push(value);
      }
      for (const email of emails) {
        evidence.push(
          makeEvidence({
            field: "email",
            status: "found",
            value: email,
            source: "website",
            sourceUrl: url,
            notes: "Email publicado en el sitio.",
          }),
        );
        findings.emails.push(email);
      }
      for (const phone of phones) {
        evidence.push(
          makeEvidence({
            field: "phone",
            status: "found",
            value: phone,
            source: "website",
            sourceUrl: url,
            notes: "Teléfono publicado en el sitio.",
          }),
        );
        findings.phones.push(phone);
      }
      if (commerce.ecommerce) {
        evidence.push(
          makeEvidence({
            field: "ecommerce",
            status: "inferred",
            value: true,
            source: "website",
            sourceUrl: url,
            confidence: 0.6,
            notes: `Señales: ${commerce.markers.join(", ")}`,
          }),
        );
        findings.ecommerce = true;
      }
      if (commerce.catalog) {
        evidence.push(
          makeEvidence({
            field: "catalog",
            status: "inferred",
            value: true,
            source: "website",
            sourceUrl: url,
            confidence: 0.6,
            notes: `Señales: ${commerce.markers.join(", ")}`,
          }),
        );
        findings.catalog = true;
      }
      if (commerce.contactForm) {
        evidence.push(
          makeEvidence({
            field: "contact_form",
            status: "found",
            value: url,
            source: "website",
            sourceUrl: url,
            notes: "Formulario de contacto detectado.",
          }),
        );
        findings.contactForm = true;
      }
      findings.commerceMarkers = [...new Set([...findings.commerceMarkers, ...commerce.markers])];
      findings.structuredDataTypes = [
        ...new Set([...findings.structuredDataTypes, ...commerce.structuredDataTypes]),
      ];

      const foundSomething =
        emails.length > 0 ||
        phones.length > 0 ||
        socials.instagram.length > 0 ||
        socials.facebook.length > 0;
      if (foundSomething && route !== "") break;
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }

  if (!pagesFetched.length) {
    evidence.push(
      makeEvidence({
        field: "website",
        status: "unknown",
        value: websiteUrl,
        source: "website",
        sourceUrl: websiteUrl,
        confidence: 0.3,
        notes: "El sitio está declarado pero no se pudo abrir; no se afirma nada sobre su contenido.",
      }),
    );
  }

  website.checkedUrls = checkedUrls;
  return {
    skipped: false,
    checkedUrls,
    pagesFetched,
    evidenceAdded: evidence.length,
    errors,
    findings,
    evidence,
    website,
  };
}
