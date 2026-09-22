import { fetchWithRetry } from "./fetch-helper";
import type { LeadEvidence } from "./lead-evidence";
import { fieldStatus, renderEvidenceLines } from "./lead-evidence";
import type {
  BusinessDossier,
  JevChoiceAnswer,
  JevDecision,
  JevNoulAnswer,
  JevRouting,
  JevUsage,
  OpportunitySignals,
} from "./opportunity-types";

/**
 * Cliente de Jev — motor rápido de decisión.
 *
 * La clave JEV_API_KEY es una clave hospedada con prefijo `jv_live_`, y su
 * contrato es el de la API de decisiones publicada en
 * https://jevtypesafeai.com/typesafe/docs (verificado contra la documentación):
 *
 *   POST https://jevtypesafeai.com/api/v1/decide
 *   Authorization: Bearer <JEV_API_KEY>
 *   Content-Type: application/json
 *   { state, questions: { id: { type, instructions, criteria } }, model? }
 *   -> { model, answers: { id: { type, choice|score|noul, confidence?, probabilities?, legend? } },
 *        usage: { input_tokens, cost_usd, credits_remaining_usd } }
 *
 * Notas del contrato:
 *  - `state` puede ser string, objeto o array (se envía un objeto con las señales).
 *  - `model` es opcional: se envía `jev-latest` salvo que se fije JEV_MODEL.
 *  - En este host las preguntas `noul` llevan SOLO `instructions`.
 *  - Errores documentados: 400, 401, 402 (insufficient_credits), 403, 404 y
 *    502 (reintentable).
 *
 * La clave sale únicamente de JEV_API_KEY (o del panel, que la guarda en
 * .env.local). Nunca se registra ni se devuelve al navegador.
 *
 * Las preguntas y los umbrales de decisión NO cambiaron en la Fase 3: lo único
 * que cambió es la información que recibe el motor (señales más ricas + dossier).
 */

export const JEV_HOSTED_ENDPOINT = "https://jevtypesafeai.com/api/v1/decide";
export const JEV_CLOUD_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_KEY_PREFIX = "jv_live_";
export const JEV_DEFAULT_MODEL = "jev-latest";
export const SIGNALS_VERSION = "signals-v2";

/** Umbrales de ruteo, decididos en nuestro código (no por el modelo). */
export const JEV_CONFIDENCE_THRESHOLD = 0.6;
export const JEV_MIN_BUSINESS_VERIFIABILITY = 0.35;

export interface JevOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  endpoint?: string;
  /** Dossier digital (Fase 3) que se adjunta al estado enviado. */
  dossier?: BusinessDossier | null;
}

export interface JevConfig {
  configured: boolean;
  model: string;
  endpoint: string;
}

/** El endpoint depende del tipo de clave: las `jv_live_` usan la API hospedada. */
export function resolveJevEndpoint(apiKey: string, override?: string): string {
  if (override && override.trim()) return override.trim();
  return apiKey.trim().startsWith(JEV_KEY_PREFIX)
    ? JEV_HOSTED_ENDPOINT
    : JEV_CLOUD_ENDPOINT;
}

export function resolveJevConfig(options: JevOptions = {}): JevConfig {
  const apiKey = (options.apiKey ?? process.env.JEV_API_KEY ?? "").trim();
  return {
    configured: Boolean(apiKey),
    model: options.model || process.env.JEV_MODEL || JEV_DEFAULT_MODEL,
    endpoint: resolveJevEndpoint(apiKey, options.endpoint ?? process.env.JEV_ENDPOINT),
  };
}

/* ------------------------------------------------------------------ */
/* Señales: solo hechos observados, con su estado de evidencia          */
/* ------------------------------------------------------------------ */

export interface SignalLeadLike {
  place_id?: string;
  nombre?: string;
  rubro?: string;
  zona?: string;
  direccion?: string;
  website?: string;
  telefono?: string;
  email?: string;
  rating?: string | number;
}

const SIGNAL_FIELDS = [
  "website",
  "phone",
  "email",
  "instagram",
  "facebook",
  "whatsapp",
  "ecommerce",
  "catalog",
] as const;

/** Construye las señales que se envían al motor de decisión. */
export function buildOpportunitySignals(
  lead: SignalLeadLike,
  evidence: LeadEvidence[] | undefined,
  dossier?: BusinessDossier | null,
): OpportunitySignals {
  const status = (field: string) => fieldStatus(evidence, field as never);
  const supported = (field: string) => {
    const value = status(field);
    return value === "verified" || value === "found";
  };

  const websiteStatus = status("website");
  const websiteSearched =
    websiteStatus !== "not_searched" ||
    Boolean(lead.website && String(lead.website).trim());

  const consultedSources = Array.from(
    new Set([
      ...(evidence || []).map((item) => item.source),
      ...((dossier?.sourcesConsulted as string[] | undefined) || []),
    ]),
  ).sort();

  const socialProfile =
    supported("instagram") ||
    supported("facebook") ||
    supported("social") ||
    Boolean(dossier?.social && Object.values(dossier.social).some((list) => list.length > 0));

  return {
    version: SIGNALS_VERSION,
    business: {
      name: lead.nombre || "",
      category: lead.rubro || dossier?.business?.category || "",
      zone: lead.zona || "",
      hasAddress: Boolean(lead.direccion && String(lead.direccion).trim()),
    },
    website: {
      present: supported("website") || Boolean(lead.website && String(lead.website).trim()),
      status: websiteStatus,
      searched: websiteSearched,
    },
    hasPhone: supported("phone") || Boolean(lead.telefono && String(lead.telefono).trim()),
    hasEmail: supported("email") || Boolean(lead.email && String(lead.email).trim()),
    hasInstagram: supported("instagram"),
    hasFacebook: supported("facebook"),
    hasWhatsapp: supported("whatsapp"),
    hasEcommerce: status("ecommerce") === "verified" || status("ecommerce") === "found",
    hasCatalog: status("catalog") === "verified" || status("catalog") === "found",
    contactable:
      supported("phone") ||
      Boolean(lead.telefono && String(lead.telefono).trim()) ||
      supported("email") ||
      Boolean(lead.email && String(lead.email).trim()) ||
      supported("whatsapp"),
    rating: lead.rating ? { value: lead.rating, source: undefined } : null,
    evidenceCount: (evidence || []).length,
    notSearched: SIGNAL_FIELDS.filter((field) => status(field) === "not_searched"),
    consultedSources,
    hasContactForm: supported("contact_form") || Boolean(dossier?.contacts?.contactForms?.length),
    hasAnySocialProfile: socialProfile,
    identityStatus: dossier?.identity?.status ?? "sin_correlacionar",
    identityConfidence: dossier?.identity?.confidence,
  };
}

/* ------------------------------------------------------------------ */
/* Preguntas                                                           */
/* ------------------------------------------------------------------ */

interface JevQuestionMap {
  [id: string]: {
    type: "choice" | "noul" | "score";
    instructions: string | Record<string, unknown>;
    criteria?: unknown;
  };
}

/**
 * Las cuatro preguntas del Opportunity Engine (sin cambios en la Fase 3).
 * Las de tipo `noul` no llevan `criteria`: en este contrato solo aceptan
 * `instructions`, así que la aclaración va dentro del texto.
 */
export function buildQuestions(): JevQuestionMap {
  return {
    worth_deep_analysis: {
      type: "choice",
      instructions:
        "According to the state, is this local business worth a deep commercial analysis, or is there nothing useful to propose?",
      criteria: {
        yes: "There is at least one plausible commercial gap supported by the state (missing or weak website, no online store, no catalog, no automation, weak content) and the business looks active.",
        no: "There is nothing plausible to propose, or the state does not describe an identifiable business.",
      },
    },
    primary_gap: {
      type: "choice",
      instructions: "Which is the single most relevant commercial gap, if any?",
      criteria: {
        no_website: "No website was found in the sources consulted.",
        weak_online_presence:
          "Website exists but looks minimal or unmaintained; no clear commercial presence.",
        no_ecommerce: "Sells offline or by messages; no online store.",
        no_catalog: "No product or service catalog available online.",
        no_automation: "Manual operations that software could automate.",
        unclear: "The state does not support identifying one gap.",
      },
    },
    business_verifiable: {
      type: "noul",
      instructions:
        "The state describes one specific, real local business with at least an address or a contact channel. Answer yes only when a name plus an address, zone or direct contact channel is present; answer no when the entry is empty, duplicated or not identifiable as a business.",
    },
    evidence_sufficient: {
      type: "noul",
      instructions:
        "The state contains enough supported evidence, not inferences, to judge a commercial opportunity. Answer yes only when enough supported facts are present to reach a conclusion; answer no when key facts are missing or only inferred.",
    },
  };
}

export function buildJevState(
  signals: OpportunitySignals,
  evidence: LeadEvidence[] | undefined,
  dossier?: BusinessDossier | null,
): Record<string, unknown> {
  const state: Record<string, unknown> = {
    summary: [
      `${signals.business.name || "Comercio sin nombre"} (${signals.business.category || "rubro desconocido"}) en ${signals.business.zone || "zona desconocida"}.`,
      `Sitio web: ${signals.website.present ? "sí" : "no"} (estado de evidencia: ${signals.website.status}).`,
      `Contacto: teléfono=${signals.hasPhone ? "sí" : "no"}, email=${signals.hasEmail ? "sí" : "no"}, WhatsApp=${signals.hasWhatsapp ? "sí" : "no"}, formulario=${signals.hasContactForm ? "sí" : "no"}.`,
      `Presencia: Instagram=${signals.hasInstagram ? "sí" : "no"}, Facebook=${signals.hasFacebook ? "sí" : "no"}, tienda online=${signals.hasEcommerce ? "sí" : "no"}, catálogo=${signals.hasCatalog ? "sí" : "no"}.`,
      `Identidad correlacionada: ${signals.identityStatus}${signals.identityConfidence !== undefined ? ` (${signals.identityConfidence})` : ""}.`,
      `Campos sin buscar todavía: ${signals.notSearched.length ? signals.notSearched.join(", ") : "ninguno"}.`,
      `Fuentes consultadas: ${signals.consultedSources.length ? signals.consultedSources.join(", ") : "ninguna"}.`,
    ].join("\n"),
    signals,
    evidence: renderEvidenceLines(evidence),
  };

  if (dossier) {
    state.dossier = {
      sourcesConsulted: dossier.sourcesConsulted,
      sourcesUnavailable: dossier.sourcesUnavailable,
      coverage: {
        supported: dossier.coverage.supported,
        total: dossier.coverage.total,
        searched: dossier.coverage.searched,
        notSearched: dossier.coverage.notSearched,
      },
      website: dossier.website,
      contacts: dossier.contacts,
      social: dossier.social,
      commerce: dossier.commerce,
      google: dossier.google,
      identity: dossier.identity,
    };
  }

  return state;
}

/* ------------------------------------------------------------------ */
/* Parseo y errores                                                    */
/* ------------------------------------------------------------------ */

function sanitizeError(body: string): string {
  return body.replace(/\s+/g, " ").slice(0, 300);
}

/** Extrae el mensaje y el código del cuerpo de error, sin filtrar credenciales. */
function describeErrorBody(body: string): string {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const parts = [parsed.error, parsed.code, parsed.message].filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (parts.length) return sanitizeError(parts.join(" - "));
  } catch {
    /* el cuerpo no era JSON: se usa tal cual */
  }
  return sanitizeError(body);
}

/** Mensajes de error según lo documentado por el proveedor. */
export function describeJevError(status: number, detail: string): string {
  const extra = detail ? ` Detalle: ${detail}` : "";
  switch (status) {
    case 400:
      return `Jev rechazó la solicitud por validación (400).${extra}`;
    case 401:
      return "Jev rechazó la credencial (401): la clave falta, es inválida o fue revocada. Revisá JEV_API_KEY.";
    case 402:
      return `Jev no tiene crédito suficiente (402). Cargá saldo en jevtypesafeai.com.${extra}`;
    case 403:
      return `Jev rechazó la solicitud (403): la cuenta está inactiva.${extra}`;
    case 404:
      return `Jev no reconoce el endpoint de decisiones (404). Revisá el endpoint configurado.${extra}`;
    case 429:
      // No documentado por el proveedor; se mantiene por defensa.
      return "Jev alcanzó su límite de solicitudes (429). Esperá unos segundos y reintentá.";
    case 502:
      return `Jev devolvió un error upstream (502). Se puede reintentar con espera.${extra}`;
    default:
      return `Jev respondió ${status}.${extra}`;
  }
}

function mapChoice(answer: unknown): JevChoiceAnswer | undefined {
  if (!answer || typeof answer !== "object") return undefined;
  const item = answer as Record<string, unknown>;
  if (typeof item.choice !== "string") return undefined;
  const probabilities =
    item.probabilities && typeof item.probabilities === "object"
      ? Object.fromEntries(
          Object.entries(item.probabilities as Record<string, unknown>).map(
            ([key, value]) => [key, Number(value) || 0],
          ),
        )
      : {};
  return {
    choice: item.choice,
    confidence: Number(item.confidence) || 0,
    probabilities,
  };
}

function mapNoul(answer: unknown): JevNoulAnswer | undefined {
  if (!answer || typeof answer !== "object") return undefined;
  const value = (answer as Record<string, unknown>).noul;
  return typeof value === "number" ? { noul: value } : undefined;
}

/** Uso devuelto por la API: tokens, costo y saldo restante. */
export function mapJevUsage(usage: unknown): JevUsage | undefined {
  if (!usage || typeof usage !== "object") return undefined;
  const item = usage as Record<string, unknown>;
  const num = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;
  const mapped: JevUsage = {
    input_tokens: num(item.input_tokens),
    output_tokens: num(item.output_tokens),
    cost_usd: num(item.cost_usd),
    credits_remaining_usd: num(item.credits_remaining_usd),
  };
  return Object.values(mapped).some((value) => value !== undefined) ? mapped : undefined;
}

/** Ruteo en código: la respuesta dice qué, la confianza dice si actuar. */
export function routeJevDecision(
  worth: JevChoiceAnswer | undefined,
  businessVerifiable: JevNoulAnswer | undefined,
): { routing: JevRouting; reason: string } {
  if (businessVerifiable && businessVerifiable.noul < JEV_MIN_BUSINESS_VERIFIABILITY) {
    return {
      routing: "discard",
      reason: `Jev no reconoce un comercio verificable (noul=${businessVerifiable.noul})`,
    };
  }
  if (!worth) {
    return { routing: "review", reason: "Jev no devolvió la decisión principal" };
  }
  if (worth.confidence < JEV_CONFIDENCE_THRESHOLD) {
    return {
      routing: "review",
      reason: `Confianza insuficiente para decidir automáticamente (${worth.confidence} < ${JEV_CONFIDENCE_THRESHOLD})`,
    };
  }
  if (worth.choice === "yes") {
    return {
      routing: "continue",
      reason: `Jev considera que vale el análisis (confianza ${worth.confidence})`,
    };
  }
  return {
    routing: "discard",
    reason: `Jev descarta el análisis comercial (confianza ${worth.confidence})`,
  };
}

/** Envía las señales a la API de decisiones y devuelve una decisión estructurada. */
export async function askJev(
  signals: OpportunitySignals,
  evidence: LeadEvidence[] | undefined,
  options: JevOptions = {},
): Promise<JevDecision> {
  const requestedAt = new Date().toISOString();
  const config = resolveJevConfig(options);
  const base: JevDecision = {
    ok: false,
    latencyMs: 0,
    signalsVersion: signals.version,
    signals,
    requestedAt,
  };

  if (!config.configured) {
    return {
      ...base,
      error:
        "Falta JEV_API_KEY: guardala en la configuración de IA del panel o en .env.local para usar Jev.",
    };
  }

  const started = Date.now();
  const apiKey = (options.apiKey ?? process.env.JEV_API_KEY ?? "").trim();

  let response: Response;
  try {
    response = await fetchWithRetry(
      config.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          state: buildJevState(signals, evidence, options.dossier),
          model: config.model,
          questions: buildQuestions(),
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
      },
      2,
      500,
    );
  } catch (error) {
    return {
      ...base,
      latencyMs: Date.now() - started,
      error: `No se pudo consultar Jev: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const latencyMs = Date.now() - started;
  const body = await response.text();

  if (!response.ok) {
    return {
      ...base,
      latencyMs,
      error: describeJevError(response.status, describeErrorBody(body)),
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {
      ...base,
      latencyMs,
      error: `Jev devolvió una respuesta que no es JSON: ${sanitizeError(body)}`,
    };
  }

  const answers =
    payload.answers && typeof payload.answers === "object"
      ? (payload.answers as Record<string, unknown>)
      : {};
  const worthDeepAnalysis = mapChoice(answers.worth_deep_analysis);
  const primaryGap = mapChoice(answers.primary_gap);
  const businessVerifiable = mapNoul(answers.business_verifiable);
  const evidenceSufficient = mapNoul(answers.evidence_sufficient);

  if (!worthDeepAnalysis) {
    return {
      ...base,
      latencyMs,
      model: typeof payload.model === "string" ? payload.model : config.model,
      error: "Jev no devolvió la decisión principal (worth_deep_analysis).",
    };
  }

  const { routing, reason } = routeJevDecision(worthDeepAnalysis, businessVerifiable);

  return {
    ok: true,
    model: typeof payload.model === "string" ? payload.model : config.model,
    latencyMs,
    signalsVersion: signals.version,
    signals,
    routing,
    routingReason: reason,
    worthDeepAnalysis,
    primaryGap,
    businessVerifiable,
    evidenceSufficient,
    usage: mapJevUsage(payload.usage),
    requestedAt,
  };
}
