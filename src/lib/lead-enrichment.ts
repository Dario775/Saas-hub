import { fetchPublic } from "./public-fetch";
import type { EvidenceField, LeadEvidence } from "./lead-evidence";
import { makeEvidence } from "./lead-evidence";
import type { EnrichmentSummary } from "./opportunity-types";

/**
 * Enriquecimiento de UN prospecto a partir de fuentes públicas.
 *
 * Reglas de esta fase: nada de crawling masivo, nada de evadir bloqueos,
 * nada de sesiones ni cuentas. Solo se consulta el sitio que el prospecto
 * ya declara, con timeout y límite de tamaño de `public-fetch`.
 */

export interface EnrichmentFindings {
  emails: string[];
  instagram: string[];
  facebook: string[];
  whatsapp: string[];
  otherSocial: string[];
  ecommerce: boolean;
  catalog: boolean;
  contactForm: boolean;
  commerceMarkers: string[];
}

export interface LeadEnrichmentResult extends EnrichmentSummary {
  findings: EnrichmentFindings;
  pagesFetched: string[];
  /** Evidencia nueva aportada por el enriquecimiento (no reemplaza la anterior). */
  evidence: LeadEvidence[];
}

export interface EnrichmentOptions {
  /** Si es true no se hace ninguna petición de red (solo se marca lo no consultado). */
  skipFetch?: boolean;
  /** Máximo de páginas por prospecto (home + rutas de contacto). */
  maxPages?: number;
  maxBytes?: number;
  /** Presupuesto total para este prospecto. */
  deadlineMs?: number;
  fetchImpl?: typeof fetchPublic;
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

const CONTACT_ROUTES = ["", "/contacto", "/contact"];

const ECOMMERCE_MARKERS = [
  "add-to-cart",
  "add_to_cart",
  "carrito",
  "woocommerce",
  "shopify",
  "tiendanube",
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

const SOCIAL_PATTERNS: { field: EvidenceField; label: string; pattern: RegExp }[] = [
  { field: "instagram", label: "instagram", pattern: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\/-]{2,60}/gi },
  { field: "facebook", label: "facebook", pattern: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\/-]{2,80}/gi },
  { field: "whatsapp", label: "whatsapp", pattern: /https?:\/\/(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\/[A-Za-z0-9_.?=&%\/-]{4,120}/gi },
];

const OTHER_SOCIAL_PATTERN = /https?:\/\/(?:www\.)?(?:tiktok\.com|linkedin\.com|youtube\.com|x\.com|twitter\.com)\/[A-Za-z0-9_.\/?=&%-]{2,80}/gi;

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

export function detectCommerceSignals(html: string): {
  ecommerce: boolean;
  catalog: boolean;
  contactForm: boolean;
  markers: string[];
} {
  const lower = html.toLowerCase();
  const commerceMarkers = ECOMMERCE_MARKERS.filter((marker) => lower.includes(marker));
  const catalogMarkers = CATALOG_MARKERS.filter((marker) => lower.includes(marker));
  const contactForm =
    /<form/i.test(html) && /(contacto|contact|escribinos|consulta)/i.test(html);
  return {
    ecommerce: commerceMarkers.length > 0,
    catalog: catalogMarkers.length > 0,
    contactForm,
    markers: [...commerceMarkers, ...catalogMarkers].slice(0, 8),
  };
}

function extractTelephone(html: string): string {
  const telLink = html.match(/href=["']tel:([^"']+)["']/i);
  return telLink ? telLink[1].trim() : "";
}

function emptyFindings(): EnrichmentFindings {
  return {
    emails: [],
    instagram: [],
    facebook: [],
    whatsapp: [],
    otherSocial: [],
    ecommerce: false,
    catalog: false,
    contactForm: false,
    commerceMarkers: [],
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

  if (options.skipFetch) {
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
    };
  }

  if (!websiteUrl) {
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
    };
  }

  const deadline = Date.now() + (options.deadlineMs ?? 25_000);
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 2, 3));
  const fetchImpl = options.fetchImpl || fetchPublic;
  const pauseMs = options.pauseMs ?? 250;
  let homepageHtml = "";

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
      if (!homepageHtml) homepageHtml = html;
      pagesFetched.push(url);
      if (route === "") {
        evidence.push(
          makeEvidence({
            field: "website",
            status: "verified",
            value: websiteUrl,
            source: "website",
            sourceUrl: url,
            notes: "El sitio declarado respondió correctamente.",
          }),
        );
      }
      const socials = extractSocialLinks(html);
      const commerce = detectCommerceSignals(html);
      const emails = extractEmails(html);
      const telephone = extractTelephone(html);

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
      if (telephone && !(lead.telefono || "").trim()) {
        evidence.push(
          makeEvidence({
            field: "phone",
            status: "found",
            value: telephone,
            source: "website",
            sourceUrl: url,
            notes: "Teléfono publicado en el sitio.",
          }),
        );
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
            notes: `Señales de tienda online: ${commerce.markers.join(", ")}`,
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
            notes: "Señales de catálogo o listado de productos.",
          }),
        );
        findings.catalog = true;
      }
      findings.contactForm = findings.contactForm || commerce.contactForm;
      findings.commerceMarkers = [...new Set([...findings.commerceMarkers, ...commerce.markers])];

      const foundSomething =
        emails.length > 0 || socials.instagram.length > 0 || socials.facebook.length > 0;
      if (foundSomething && route !== "") break;
    } catch (error) {
      errors.push(
        `${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
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
  } else if (!homepageHtml.trim()) {
    errors.push("El sitio respondió pero sin contenido analizable.");
  }

  return {
    skipped: false,
    checkedUrls,
    pagesFetched,
    evidenceAdded: evidence.length,
    errors,
    findings,
    evidence,
  };
}
