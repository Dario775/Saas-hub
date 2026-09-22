import { fetchWithRetry } from "./fetch-helper";
import type { LeadEvidence } from "./lead-evidence";
import { fieldStatus, renderEvidenceLines } from "./lead-evidence";
import type {
  JevChoiceAnswer,
  JevDecision,
  JevNoulAnswer,
  JevRouting,
  OpportunitySignals,
} from "./opportunity-types";

/**
 * Cliente de Jev (TypeSafe AI) — motor rápido de decisión.
 *
 * Contrato tomado de la documentación oficial (docs.typesafe.ai):
 *   POST https://api.typesafe.ai/v1/systemone
 *   Authorization: Bearer <API_KEY>
 *   { state, model, questions: { id: { type, instructions, criteria } } }
 *   -> { model, answers: { id: { type, choice|score|noul, confidence?, probabilities? } }, usage }
 *
 * La clave sale únicamente de JEV_API_KEY (o del panel, que la guarda en .env.local).
 * Nunca se registra ni se devuelve al navegador.
 */

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_DEFAULT_MODEL = "jev-latest";
export const SIGNALS_VERSION = "signals-v1";

/** Umbrales de ruteo, decididos en nuestro código (no por el modelo). */
export const JEV_CONFIDENCE_THRESHOLD = 0.6;
export const JEV_MIN_BUSINESS_VERIFIABILITY = 0.35;

export interface JevOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export interface JevConfig {
  configured: boolean;
  model: string;
  endpoint: string;
}

export function resolveJevConfig(options: JevOptions = {}): JevConfig {
  const apiKey = options.apiKey ?? process.env.JEV_API_KEY ?? "";
  return {
    configured: Boolean(apiKey.trim()),
    model: options.model || process.env.JEV_MODEL || JEV_DEFAULT_MODEL,
    endpoint: JEV_ENDPOINT,
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
    new Set((evidence || []).map((item) => item.source)),
  ).sort();

  return {
    version: SIGNALS_VERSION,
    business: {
      name: lead.nombre || "",
      category: lead.rubro || "",
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
  };
}

/* ------------------------------------------------------------------ */
/* Consulta                                                            */
/* ------------------------------------------------------------------ */

interface JevQuestionMap {
  [id: string]: {
    type: "choice" | "noul" | "score";
    instructions: string | Record<string, unknown>;
    criteria?: unknown;
  };
}

function buildQuestions(): JevQuestionMap {
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
        weak_online_presence: "Website exists but looks minimal or unmaintained; no clear commercial presence.",
        no_ecommerce: "Sells offline or by messages; no online store.",
        no_catalog: "No product or service catalog available online.",
        no_automation: "Manual operations that software could automate.",
        unclear: "The state does not support identifying one gap.",
      },
    },
    business_verifiable: {
      type: "noul",
      instructions:
        "The state describes one specific, real local business with at least an address or a contact channel.",
      criteria: {
        true: "A name plus address, zone or direct contact channel is present.",
        false: "The entry is empty, duplicated or not identifiable as a business.",
      },
    },
    evidence_sufficient: {
      type: "noul",
      instructions:
        "The state contains enough supported evidence (not inferences) to judge a commercial opportunity.",
      criteria: {
        true: "Enough supported facts are present to reach a conclusion.",
        false: "Key facts are missing or only inferred.",
      },
    },
  };
}

export function buildJevState(
  signals: OpportunitySignals,
  evidence: LeadEvidence[] | undefined,
): Record<string, unknown> {
  return {
    summary: [
      `${signals.business.name || "Comercio sin nombre"} (${signals.business.category || "rubro desconocido"}) en ${signals.business.zone || "zona desconocida"}.`,
      `Sitio web: ${signals.website.present ? "sí" : "no"} (estado de evidencia: ${signals.website.status}).`,
      `Contacto: teléfono=${signals.hasPhone ? "sí" : "no"}, email=${signals.hasEmail ? "sí" : "no"}, WhatsApp=${signals.hasWhatsapp ? "sí" : "no"}.`,
      `Presencia: Instagram=${signals.hasInstagram ? "sí" : "no"}, Facebook=${signals.hasFacebook ? "sí" : "no"}, tienda online=${signals.hasEcommerce ? "sí" : "no"}, catálogo=${signals.hasCatalog ? "sí" : "no"}.`,
      `Campos sin buscar todavía: ${signals.notSearched.length ? signals.notSearched.join(", ") : "ninguno"}.`,
    ].join("\n"),
    signals,
    evidence: renderEvidenceLines(evidence),
  };
}

function sanitizeError(body: string): string {
  return body.replace(/\s+/g, " ").slice(0, 300);
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
    return { routing: "continue", reason: `Jev considera que vale el análisis (confianza ${worth.confidence})` };
  }
  return { routing: "discard", reason: `Jev descarta el análisis comercial (confianza ${worth.confidence})` };
}

/** Envía las señales a Jev y devuelve una decisión estructurada. */
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
          state: buildJevState(signals, evidence),
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
    const detail = sanitizeError(body);
    const message =
      response.status === 401 || response.status === 403
        ? `Jev rechazó la credencial (${response.status}). Revisá JEV_API_KEY.`
        : response.status === 429
          ? "Jev alcanzó su límite de solicitudes. Esperá unos segundos."
          : `Jev respondió ${response.status}: ${detail}`;
    return { ...base, latencyMs, error: message };
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
  const usage = payload.usage as Record<string, unknown> | undefined;

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
    usage: usage
      ? {
          input_tokens: Number(usage.input_tokens) || undefined,
          output_tokens: Number(usage.output_tokens) || undefined,
        }
      : undefined,
    requestedAt,
  };
}
