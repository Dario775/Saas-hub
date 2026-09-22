import type { DataStatus, EvidenceCoverage, EvidenceSource, LeadEvidence } from "./lead-evidence";

/** Señales estructuradas derivadas de evidencia real, listas para un motor de decisión. */
export interface OpportunitySignals {
  version: string;
  business: {
    name: string;
    category: string;
    zone: string;
    hasAddress: boolean;
  };
  website: {
    present: boolean;
    status: DataStatus;
    searched: boolean;
  };
  hasPhone: boolean;
  hasEmail: boolean;
  hasInstagram: boolean;
  hasFacebook: boolean;
  hasWhatsapp: boolean;
  hasEcommerce: boolean;
  hasCatalog: boolean;
  contactable: boolean;
  rating: { value?: string | number; source?: EvidenceSource } | null;
  evidenceCount: number;
  notSearched: string[];
  consultedSources: string[];
}

export interface JevChoiceAnswer {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface JevNoulAnswer {
  noul: number;
}

/** Uso devuelto por la API de decisiones: tokens, costo y saldo restante. */
export interface JevUsage {
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  credits_remaining_usd?: number;
}

export type JevRouting = "continue" | "discard" | "review";

export interface JevDecision {
  ok: boolean;
  error?: string;
  model?: string;
  latencyMs: number;
  signalsVersion: string;
  signals: OpportunitySignals;
  routing?: JevRouting;
  routingReason?: string;
  worthDeepAnalysis?: JevChoiceAnswer;
  primaryGap?: JevChoiceAnswer;
  businessVerifiable?: JevNoulAnswer;
  evidenceSufficient?: JevNoulAnswer;
  usage?: JevUsage;
  requestedAt: string;
}

export interface OpportunityAnalysis {
  ok: boolean;
  error?: string;
  provider: string;
  model: string;
  latencyMs: number;
  opportunityDetected: boolean;
  opportunityType?: string;
  problemDetected?: string;
  evidenceUsed: string[];
  proposedSolution?: string;
  recommendedProducts?: string[];
  reasoning?: string;
  evidenceCoverage: EvidenceCoverage;
  parsedJson: boolean;
  analyzedAt: string;
}

export interface OpportunitySummary {
  analyzedAt: string;
  detected: boolean;
  opportunityType?: string;
  solution?: string;
  jevRouting?: JevRouting;
  jevModel?: string;
  analysisModel?: string;
  logId?: string;
}

export interface EnrichmentSummary {
  checkedUrls: string[];
  evidenceAdded: number;
  errors: string[];
  skipped: boolean;
}

export interface OpportunityResult {
  ok: boolean;
  error?: string;
  stage: "enrichment" | "jev" | "analysis" | "done";
  leadId: string;
  identity?: string;
  durationMs: number;
  enrichment: EnrichmentSummary;
  evidence: LeadEvidence[];
  signals?: OpportunitySignals;
  jev?: JevDecision;
  analysis?: OpportunityAnalysis;
  logId?: string;
}

export interface OpportunityLogRecord {
  id: string;
  timestamp: string;
  leadId: string;
  identity?: string;
  signalsVersion: string;
  signals: OpportunitySignals;
  jev: {
    ok: boolean;
    model?: string;
    latencyMs: number;
    routing?: JevRouting;
    routingReason?: string;
    error?: string;
    answers?: {
      worthDeepAnalysis?: JevChoiceAnswer;
      primaryGap?: JevChoiceAnswer;
      businessVerifiable?: JevNoulAnswer;
      evidenceSufficient?: JevNoulAnswer;
    };
    usage?: JevUsage;
  };
  passedToDeepSeek: boolean;
  deepseek?: {
    ok: boolean;
    provider: string;
    model: string;
    latencyMs: number;
    error?: string;
    opportunityDetected?: boolean;
    opportunityType?: string;
    evidenceCoverage?: EvidenceCoverage;
  };
  finalStage: OpportunityResult["stage"];
  errors: string[];
  durationMs: number;
}
