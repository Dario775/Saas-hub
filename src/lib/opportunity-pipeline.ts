import { randomUUID } from "node:crypto";
import { enrichLead } from "./lead-enrichment";
import type { EnrichmentOptions } from "./lead-enrichment";
import type { LeadEvidence } from "./lead-evidence";
import { mergeEvidence } from "./lead-evidence";
import type { JevOptions } from "./jev";
import { askJev, buildOpportunitySignals } from "./jev";
import { appendOpportunityLog } from "./opportunity-log";
import { analyzeWithDeepSeek } from "./opportunity-analysis";
import type {
  JevDecision,
  OpportunityLogRecord,
  OpportunityResult,
  OpportunitySummary,
} from "./opportunity-types";
import type { LLMSettings } from "./llm";
import { getCampaignConfig, getLeads, mutateLeads } from "./leads-service";
import type { LeadItem } from "./leads-service";

/**
 * Orquestador del Opportunity Engine.
 *
 *   Lead -> enriquecer -> evidencia -> Jev -> (descarta: fin) -> DeepSeek -> resultado
 *
 * Se ejecuta únicamente por acción explícita del usuario. No contacta a nadie,
 * no publica nada y no modifica datos existentes: solo agrega evidencia y un
 * resumen del último análisis al prospecto.
 */

export interface OpportunityLeadStore {
  get(leadId: string): Promise<LeadItem | undefined>;
  save(
    leadId: string,
    evidence: LeadEvidence[],
    summary?: OpportunitySummary | null,
  ): Promise<void>;
}

/** Persistencia real: los mismos archivos JSON del CRM, con bloqueo. */
export const jsonLeadStore: OpportunityLeadStore = {
  async get(leadId: string) {
    return getLeads().find((lead) => lead.place_id === leadId);
  },
  async save(leadId, evidence, summary) {
    await mutateLeads((leads) => {
      const target = leads.find((lead) => lead.place_id === leadId);
      if (!target) return;
      target.evidence = mergeEvidence(target.evidence, evidence);
      if (summary !== undefined) target.opportunity = summary;
    });
  },
};

export interface AnalyzeOpportunityOptions {
  skipEnrichment?: boolean;
  skipJev?: boolean;
  skipAnalysis?: boolean;
  enrichment?: EnrichmentOptions;
  jev?: JevOptions;
  analysis?: { settings?: LLMSettings };
  store?: OpportunityLeadStore;
  logFile?: string;
  seller?: { brandName?: string; valueProposition?: string };
}

const inFlight = new Map<string, Promise<OpportunityResult>>();

export function isAnalysisInFlight(leadId: string): boolean {
  return inFlight.has(leadId);
}

/**
 * Ejecuta el pipeline. Si ya hay un análisis en curso para el mismo prospecto
 * devuelve esa misma promesa (protección contra doble clic).
 */
export function analyzeOpportunity(
  lead: LeadItem,
  options: AnalyzeOpportunityOptions = {},
): Promise<OpportunityResult> {
  const running = inFlight.get(lead.place_id);
  if (running) return running;
  const run = runOpportunityAnalysis(lead, options).finally(() =>
    inFlight.delete(lead.place_id),
  );
  inFlight.set(lead.place_id, run);
  return run;
}

export function resolveSellerContext() {
  const campaign = getCampaignConfig();
  return {
    brandName: campaign.brandName || campaign.name,
    valueProposition: campaign.valueProposition,
  };
}

async function runOpportunityAnalysis(
  lead: LeadItem,
  options: AnalyzeOpportunityOptions,
): Promise<OpportunityResult> {
  const started = Date.now();
  const store = options.store || jsonLeadStore;
  const errors: string[] = [];
  const result: OpportunityResult = {
    ok: true,
    stage: "enrichment",
    leadId: lead.place_id,
    identity: lead.identity,
    durationMs: 0,
    enrichment: { checkedUrls: [], evidenceAdded: 0, errors: [], skipped: false },
    evidence: lead.evidence || [],
  };

  // 1) Enriquecimiento (solo datos públicos del sitio ya declarado).
  const enrichment = await enrichLead(lead, lead.evidence, {
    ...options.enrichment,
    skipFetch: options.skipEnrichment || options.enrichment?.skipFetch,
  });
  result.enrichment = {
    checkedUrls: enrichment.checkedUrls,
    evidenceAdded: enrichment.evidence.length,
    errors: enrichment.errors,
    skipped: enrichment.skipped,
  };
  result.evidence = mergeEvidence(lead.evidence, enrichment.evidence);
  errors.push(...enrichment.errors);

  // Se guarda la evidencia antes de las llamadas de IA: si algo falla después,
  // el trabajo de enriquecimiento no se pierde.
  try {
    await store.save(lead.place_id, result.evidence);
  } catch (error) {
    errors.push(
      `No se pudo guardar la evidencia: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const signals = buildOpportunitySignals(lead, result.evidence);
  result.signals = signals;

  // 2) Jev: motor rápido de decisión.
  let jev: JevDecision | undefined;
  if (!options.skipJev) {
    jev = await askJev(signals, result.evidence, options.jev);
    result.jev = jev;
    if (!jev.ok && jev.error) errors.push(jev.error);
  }

  let analysis: Awaited<ReturnType<typeof analyzeWithDeepSeek>> | undefined;
  const jevFailed = Boolean(!options.skipJev && jev && !jev.ok);

  if (jev?.ok && jev.routing === "discard") {
    // Jev descartó el prospecto: no se gasta análisis profundo.
    result.stage = "jev";
    result.ok = true;
  } else if (jevFailed) {
    // Jev estaba configurado y no pudo decidir: se corta y se informa el motivo.
    // Para analizar sin clasificador, volver a ejecutar con skipJev.
    result.stage = "jev";
    result.ok = false;
  } else {
    // 3) DeepSeek: análisis comercial profundo.
    if (!options.skipAnalysis) {
      analysis = await analyzeWithDeepSeek(
        {
          lead,
          evidence: result.evidence,
          signals,
          jev,
          seller: options.seller || resolveSellerContext(),
        },
        options.analysis,
      );
      result.analysis = analysis;
      if (!analysis.ok && analysis.error) errors.push(analysis.error);
    }
    result.ok = options.skipAnalysis ? true : Boolean(analysis?.ok);
    result.stage = !options.skipAnalysis && analysis?.ok ? "done" : "analysis";
  }

  if (!result.ok && errors.length) result.error = errors[0];

  const logId = randomUUID();
  const summary: OpportunitySummary = {
    analyzedAt: new Date().toISOString(),
    detected: Boolean(analysis?.opportunityDetected),
    opportunityType: analysis?.opportunityType,
    solution: analysis?.proposedSolution,
    jevRouting: jev?.routing,
    jevModel: jev?.model,
    analysisModel: analysis?.model,
    logId,
  };

  try {
    await store.save(lead.place_id, result.evidence, summary);
  } catch (error) {
    errors.push(
      `No se pudo guardar el resumen del análisis: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  result.logId = logId;
  result.durationMs = Date.now() - started;

  const record: OpportunityLogRecord = {
    id: logId,
    timestamp: new Date().toISOString(),
    leadId: lead.place_id,
    identity: lead.identity,
    signalsVersion: signals.version,
    signals,
    jev: {
      ok: Boolean(jev?.ok),
      model: jev?.model,
      latencyMs: jev?.latencyMs || 0,
      routing: jev?.routing,
      routingReason: jev?.routingReason,
      error: jev?.error,
      answers: jev
        ? {
            worthDeepAnalysis: jev.worthDeepAnalysis,
            primaryGap: jev.primaryGap,
            businessVerifiable: jev.businessVerifiable,
            evidenceSufficient: jev.evidenceSufficient,
          }
        : undefined,
      usage: jev?.usage,
    },
    passedToDeepSeek: Boolean(analysis),
    deepseek: analysis
      ? {
          ok: analysis.ok,
          provider: analysis.provider,
          model: analysis.model,
          latencyMs: analysis.latencyMs,
          error: analysis.error,
          opportunityDetected: analysis.opportunityDetected,
          opportunityType: analysis.opportunityType,
          evidenceCoverage: analysis.evidenceCoverage,
        }
      : undefined,
    finalStage: result.stage,
    errors,
    durationMs: result.durationMs,
  };

  try {
    await appendOpportunityLog(record, options.logFile);
  } catch (error) {
    // El registro no debe romper el análisis.
    result.enrichment.errors.push(
      `No se pudo registrar la observabilidad: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}
