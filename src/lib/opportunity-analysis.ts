import type { EvidenceField, LeadEvidence } from "./lead-evidence";
import {
  DEFAULT_EVALUATED_FIELDS,
  evidenceCoverage,
  fieldStatus,
  renderEvidenceLines,
} from "./lead-evidence";
import type { LLMSettings } from "./llm";
import { queryLLM, resolveLLMConfig } from "./llm";
import type {
  BusinessDossier,
  JevDecision,
  OpportunityAnalysis,
  OpportunitySignals,
} from "./opportunity-types";

/**
 * Análisis comercial profundo con DeepSeek.
 *
 * En la Fase 3 solo cambió lo que recibe: además de la evidencia, se le pasa
 * el dossier digital de forma estructurada. Las reglas del prompt y el
 * esquema de salida siguen siendo los mismos.
 */

/** Productos y servicios que hoy podemos ofrecer. Sin precios inventados. */
export const PRODUCT_CATALOG = [
  {
    id: "obsidiana",
    name: "Obsidiana",
    description:
      "Punto de venta, facturación electrónica ARCA, control de stock y caja para comercios minoristas.",
  },
  {
    id: "ecommerce",
    name: "Tienda online",
    description: "Ecommerce con catálogo, carrito, medios de pago y envíos.",
  },
  {
    id: "landing",
    name: "Landing page",
    description: "Página única de alta conversión con dominio propio y contacto directo por WhatsApp.",
  },
  {
    id: "website",
    name: "Sitio web institucional",
    description: "Sitio para mostrar el negocio, sus servicios y datos de contacto.",
  },
  {
    id: "automation",
    name: "Automatización",
    description: "Automatizar tareas repetitivas: presupuestos, recordatorios, seguimiento de clientes, reportes.",
  },
  {
    id: "marketing",
    name: "Marketing y contenido",
    description: "Contenido y campañas para redes, con piezas gráficas y publicaciones programadas.",
  },
  {
    id: "software",
    name: "Software a medida",
    description: "Desarrollo específico cuando el proceso del negocio no encaja en una herramienta existente.",
  },
] as const;

/** Campos que se evalúan para medir cobertura de evidencia. */
export const ANALYZED_FIELDS: EvidenceField[] = DEFAULT_EVALUATED_FIELDS;

export interface AnalysisLeadLike {
  nombre?: string;
  rubro?: string;
  zona?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  website?: string;
  rating?: string | number;
  status?: string;
  notes?: string;
}

export interface AnalysisInput {
  lead: AnalysisLeadLike;
  evidence: LeadEvidence[] | undefined;
  signals?: OpportunitySignals;
  jev?: JevDecision;
  seller?: { brandName?: string; valueProposition?: string };
  /** Dossier digital de la Fase 3 (opcional para no romper consumidores previos). */
  dossier?: BusinessDossier | null;
}

const ALLOWED_FIELDS = new Set<string>(ANALYZED_FIELDS);

const ANALYSIS_SYSTEM_PROMPT = `Eres un analista comercial B2B especializado en comercios locales (Argentina).
Analizás UN comercio con la evidencia disponible y proponés (o descartás) una oportunidad comercial concreta.

Reglas obligatorias:
1. Solo podés afirmar hechos respaldados por la evidencia listada. Si un dato no figura, no lo supongas.
2. Nunca afirmes que algo "no existe". Decí "no se encontró en las fuentes consultadas".
3. Los datos marcados como "inferred" son indicios, no hechos: presentalos como posibilidad, nunca como certeza.
4. No fuerces una venta. Si no hay una oportunidad clara, respondé opportunityDetected=false y explicá por qué.
5. No inventes cifras, precios, reseñas, cantidad de clientes ni volúmenes de venta.
6. No incluyas datos de contacto ni datos personales en la propuesta.
7. Respondé ÚNICAMENTE con un objeto JSON con esta forma exacta, sin texto adicional ni bloques de código:
{"opportunityDetected": boolean, "opportunityType": string|null, "problemDetected": string|null, "evidenceUsed": string[], "proposedSolution": string|null, "recommendedProducts": string[], "reasoning": string}
"evidenceUsed" solo puede contener nombres de campo presentes en la evidencia (por ejemplo: website, instagram, ecommerce).
"recommendedProducts" solo puede contener ids de la lista de productos que se te entrega.`;

export function buildAnalysisUserPrompt(input: AnalysisInput): string {
  const { lead, evidence, signals, jev, seller, dossier } = input;
  const lines: string[] = [];
  lines.push("COMERCIO:");
  lines.push(`- Nombre: ${lead.nombre || "(sin nombre)"}`);
  lines.push(`- Rubro: ${lead.rubro || "(sin rubro)"}`);
  lines.push(`- Zona: ${lead.zona || "(sin zona)"}`);
  if (lead.direccion) lines.push(`- Dirección: ${lead.direccion}`);
  if (lead.rating) lines.push(`- Puntuación pública declarada: ${lead.rating}`);
  lines.push("");
  lines.push("EVIDENCIA (campo | estado | valor | fuente | url | confianza | nota):");
  const evidenceLines = renderEvidenceLines(evidence);
  lines.push(evidenceLines.length ? evidenceLines.join("\n") : "- (sin evidencia registrada)");
  lines.push("");
  if (dossier) {
    lines.push("DOSSIER DIGITAL (resultado del descubrimiento previo; los estados importan):");
    lines.push(
      JSON.stringify(
        {
          identidad: dossier.identity,
          sitio: dossier.website,
          contactos: dossier.contacts,
          redes: dossier.social,
          comercio: dossier.commerce,
          google: dossier.google,
          fuentesConsultadas: dossier.sourcesConsulted,
          fuentesNoDisponibles: dossier.sourcesUnavailable,
          cobertura: {
            respaldados: dossier.coverage.supported,
            total: dossier.coverage.total,
            buscados: dossier.coverage.searched,
            noBuscados: dossier.coverage.notSearched,
            noEncontrados: dossier.coverage.notFound,
          },
        },
        null,
        2,
      ),
    );
    lines.push("");
  }
  if (signals) {
    lines.push("SEÑALES ESTRUCTURADAS:");
    lines.push(JSON.stringify(signals, null, 2));
    lines.push("");
  }
  if (jev) {
    lines.push("DECISIÓN DEL CLASIFICADOR RÁPIDO (no es evidencia, es una orientación):");
    lines.push(
      `- ruteo=${jev.routing || "sin ruteo"} motivo=${jev.routingReason || "sin motivo"}` +
        (jev.primaryGap ? ` brecha_principal=${jev.primaryGap.choice}` : ""),
    );
    lines.push("");
  }
  if (seller?.brandName || seller?.valueProposition) {
    lines.push("QUIÉN OFRECE:");
    lines.push(`- Marca: ${seller?.brandName || "(sin marca)"}`);
    if (seller?.valueProposition) lines.push(`- Propuesta: ${seller.valueProposition}`);
    lines.push("");
  }
  lines.push("PRODUCTOS DISPONIBLES (usá solo estos ids):");
  lines.push(
    PRODUCT_CATALOG.map((item) => `- ${item.id}: ${item.name} — ${item.description}`).join("\n"),
  );
  lines.push("");
  lines.push("Devolvé el JSON del análisis.");
  return lines.join("\n");
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeAnalysisJson(raw: string): {
  ok: boolean;
  error?: string;
  data?: {
    opportunityDetected: boolean;
    opportunityType?: string;
    problemDetected?: string;
    evidenceUsed: string[];
    proposedSolution?: string;
    recommendedProducts: string[];
    reasoning?: string;
  };
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "El analista no devolvió JSON válido." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "El JSON del analista no es un objeto." };
  }
  const data = parsed as Record<string, unknown>;
  if (typeof data.opportunityDetected !== "boolean") {
    return { ok: false, error: "El JSON del analista no incluye opportunityDetected booleano." };
  }
  const evidenceUsed = Array.isArray(data.evidenceUsed)
    ? data.evidenceUsed
        .map((item) => String(item).trim().toLowerCase())
        .filter((item) => ALLOWED_FIELDS.has(item))
    : [];
  const productIds = new Set(PRODUCT_CATALOG.map((item) => item.id as string));
  const recommendedProducts = Array.isArray(data.recommendedProducts)
    ? data.recommendedProducts
        .map((item) => String(item).trim().toLowerCase())
        .filter((item) => productIds.has(item))
    : [];
  return {
    ok: true,
    data: {
      opportunityDetected: data.opportunityDetected,
      opportunityType: asString(data.opportunityType),
      problemDetected: asString(data.problemDetected),
      evidenceUsed: [...new Set(evidenceUsed)],
      proposedSolution: asString(data.proposedSolution),
      recommendedProducts: [...new Set(recommendedProducts)],
      reasoning: asString(data.reasoning),
    },
  };
}

/**
 * Análisis comercial profundo con DeepSeek.
 *
 * No se pide ni se inventa una "confidence": la única medida que agregamos
 * es la cobertura de evidencia, calculada en código con una fórmula explícita
 * (ver evidenceCoverage en lead-evidence.ts).
 */
export async function analyzeWithDeepSeek(
  input: AnalysisInput,
  options: { settings?: LLMSettings } = {},
): Promise<OpportunityAnalysis> {
  const settings: LLMSettings = options.settings || { provider: "deepseek" };
  const { model } = resolveLLMConfig(settings);
  const provider = settings.provider || "deepseek";
  const coverage = evidenceCoverage(input.evidence, ANALYZED_FIELDS);
  const analyzedAt = new Date().toISOString();
  const started = Date.now();

  let raw = "";
  try {
    raw = await queryLLM(
      ANALYSIS_SYSTEM_PROMPT,
      buildAnalysisUserPrompt(input),
      settings,
      true,
      { timeoutMs: 90_000 },
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falló la llamada al analista.",
      provider,
      model,
      latencyMs: Date.now() - started,
      opportunityDetected: false,
      evidenceUsed: [],
      evidenceCoverage: coverage,
      parsedJson: false,
      analyzedAt,
    };
  }

  const latencyMs = Date.now() - started;
  const parsed = normalizeAnalysisJson(raw);
  if (!parsed.ok || !parsed.data) {
    return {
      ok: false,
      error: parsed.error,
      provider,
      model,
      latencyMs,
      opportunityDetected: false,
      evidenceUsed: [],
      evidenceCoverage: coverage,
      parsedJson: false,
      analyzedAt,
    };
  }

  return {
    ok: true,
    provider,
    model,
    latencyMs,
    opportunityDetected: parsed.data.opportunityDetected,
    opportunityType: parsed.data.opportunityType,
    problemDetected: parsed.data.problemDetected,
    evidenceUsed: parsed.data.evidenceUsed,
    proposedSolution: parsed.data.proposedSolution,
    recommendedProducts: parsed.data.recommendedProducts,
    reasoning: parsed.data.reasoning,
    evidenceCoverage: coverage,
    parsedJson: true,
    analyzedAt,
  };
}

/** Resumen legible del estado de un campo, para interfaces. */
export function describeField(evidence: LeadEvidence[] | undefined, field: EvidenceField): string {
  return fieldStatus(evidence, field);
}
