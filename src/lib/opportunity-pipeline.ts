import { randomUUID } from "node:crypto";
import { discoverBusinessPresence } from "./business-discovery";
import type { DiscoveryOptions } from "./business-discovery";
import { DEFAULT_EVALUATED_FIELDS, evidenceCoverage, mergeEvidence } from "./lead-evidence";
import type { LeadEvidence } from "./lead-evidence";
import type { JevOptions } from "./jev";
import { askJev, buildOpportunitySignals } from "./jev";
import { appendOpportunityLog } from "./opportunity-log";
import { analyzeWithDeepSeek } from "./opportunity-analysis";
import type {
  BusinessDossier,
  DiscoverySummary,
  EnrichmentSummary,
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
 *   Lead -> descubrimiento digital -> evidencias + dossier -> Jev -> DeepSeek
 *
 * Se ejecuta únicamente por acción explícita del usuario. No contacta a nadie,
 * no publica nada y no modifica datos existentes: solo agrega evidencia, un
 * dossier y un resumen del último análisis al prospecto.
 */

export interface OpportunityLeadStore {
  get(leadId: string): Promise<LeadItem | undefined>;
  save(
    leadId: string,
    evidence: LeadEvidence[],
    summary?: OpportunitySummary | null,
    dossier?: BusinessDossier | null,
  ): Promise<void>;
}

/** Persistencia real: los mismos archivos JSON del CRM, con bloqueo. */
export const jsonLeadStore: OpportunityLeadStore = {
  async get(leadId: string) {
    return getLeads().find((lead) => lead.place_id === leadId);
  },
  async save(leadId, evidence, summary, dossier) {
    await mutateLeads((leads) => {
      const target = leads.find((lead) => lead.place_id === leadId);
      if (!target) return;
      target.evidence = mergeEvidence(target.evidence, evidence);
      if (summary !== undefined) target.opportunity = summary;
      if (dossier) target.dossier = dossier;
    });
  },
};

export interface AnalyzeOpportunityOptions {
  /** Omite por completo el descubrimiento digital (no hace ninguna consulta). */
  skipEnrichment?: boolean;
  /** Ignora el dossier guardado y vuelve a consultar las fuentes. */
  forceRefresh?: boolean;
  skipJev?: boolean;
  skipAnalysis?: boolean;
  discovery?: DiscoveryOptions;
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
  const existingEvidence = lead.evidence || [];

  const result: OpportunityResult = {
    ok: true,
    stage: "enrichment",
    leadId: lead.place_id,
    identity: lead.identity,
    durationMs: 0,
    enrichment: { checkedUrls: [], evidenceAdded: 0, errors: [], skipped: Boolean(options.skipEnrichment) },
    evidence: existingEvidence,
  };

  let evidence = existingEvidence;
  let dossier: BusinessDossier | null = lead.dossier ?? null;
  let coverageBefore = evidenceCoverage(existingEvidence, DEFAULT_EVALUATED_FIELDS);
  let coverageAfter = coverageBefore;
  let discoverySummary: DiscoverySummary | undefined;

  // 1) Descubrimiento digital (antes de cualquier decisión).
  // Con skipEnrichment no se consulta ninguna fuente externa: se ordena la
  // evidencia que ya tenía el prospecto (sin red) y se deja todo lo demás
  // como no buscado.
  {
    const discovery = await discoverBusinessPresence(lead, {
      ...options.discovery,
      forceRefresh: options.forceRefresh || options.discovery?.forceRefresh,
      ...(options.skipEnrichment
        ? { skipGoogle: true, skipWebsite: true, skipWebSearch: true }
        : {}),
    });
    evidence = discovery.evidence;
    dossier = discovery.dossier;
    coverageBefore = discovery.summary.coverageBefore;
    coverageAfter = discovery.summary.coverageAfter;
    discoverySummary = discovery.summary;

    const enrichment: EnrichmentSummary = {
      checkedUrls: discovery.dossier.website.checkedUrls,
      evidenceAdded: Math.max(0, evidence.length - existingEvidence.length),
      errors: discovery.summary.sourcesFailed.map(
        (item) => `${item.source}: ${item.error}`,
      ),
      skipped: Boolean(options.skipEnrichment),
    };
    result.enrichment = enrichment;
    errors.push(...enrichment.errors);
    result.discovery = discoverySummary;
    result.dossier = dossier;
    result.coverageBefore = coverageBefore;
    result.coverageAfter = coverageAfter;

    // Se guarda antes de las llamadas de IA: si algo falla después, el trabajo
    // de descubrimiento no se pierde.
    try {
      await store.save(lead.place_id, evidence, undefined, dossier);
    } catch (error) {
      errors.push(
        `No se pudo guardar la evidencia: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  result.evidence = evidence;
  const signals = buildOpportunitySignals(lead, evidence, dossier);
  result.signals = signals;

  // 2) Jev: motor rápido de decisión (mismas preguntas y umbrales).
  let jev: JevDecision | undefined;
  if (!options.skipJev) {
    jev = await askJev(signals, evidence, { ...options.jev, dossier });
    result.jev = jev;
    if (!jev.ok && jev.error) errors.push(jev.error);
  }

  let analysis: Awaited<ReturnType<typeof analyzeWithDeepSeek>> | undefined;
  const jevFailed = Boolean(!options.skipJev && jev && !jev.ok);

  if (jev?.ok && jev.routing === "discard") {
    result.stage = "jev";
    result.ok = true;
  } else if (jevFailed) {
    result.stage = "jev";
    result.ok = false;
  } else {
    if (!options.skipAnalysis) {
      analysis = await analyzeWithDeepSeek(
        {
          lead,
          evidence,
          signals,
          jev,
          seller: options.seller || resolveSellerContext(),
          dossier,
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
    await store.save(lead.place_id, evidence, summary, dossier);
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
    discovery: discoverySummary,
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
