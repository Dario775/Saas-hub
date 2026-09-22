import type {
  DataStatus,
  EvidenceCoverage,
  EvidenceSource,
  LeadEvidence,
} from "./lead-evidence";
import type { IdentityMatchStatus } from "./identity-match";

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
  /** Agregados por la Fase 3 (opcionales para no romper consumidores previos). */
  hasContactForm?: boolean;
  hasAnySocialProfile?: boolean;
  identityStatus?: IdentityMatchStatus | "sin_correlacionar";
  identityConfidence?: number;
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

/* ------------------------------------------------------------------ */
/* Business dossier (Fase 3)                                           */
/* ------------------------------------------------------------------ */

export interface IdentityMatchSummary {
  status: IdentityMatchStatus;
  confidence: number;
  score: number;
  candidateName?: string;
  candidateSource: EvidenceSource;
  candidateUrl?: string;
  matchedSignals: string[];
  conflictingSignals: string[];
}

export interface DossierWebsiteBlock {
  status: DataStatus;
  url?: string;
  reachable?: boolean;
  finalUrl?: string;
  title?: string;
  description?: string;
  checkedUrls: string[];
}

export interface DossierContactsBlock {
  phones: string[];
  whatsapp: string[];
  emails: string[];
  contactForms: string[];
}

export interface DossierSocialBlock {
  instagram: string[];
  facebook: string[];
  tiktok: string[];
  linkedin: string[];
  youtube: string[];
}

export interface DossierCommerceBlock {
  ecommerce: DataStatus;
  catalog: DataStatus;
  markers: string[];
}

export interface DossierGoogleBlock {
  placeId?: string;
  matchedPlaceId?: string;
  rating?: number;
  ratingCount?: number;
  businessStatus?: string;
  primaryType?: string;
  mapsUri?: string;
  candidatesFound: number;
}

export interface BusinessDossier {
  leadId: string;
  identity?: IdentityMatchSummary | null;
  business: {
    name: string;
    category: string;
    address: string;
    coordinates?: { lat?: number; lon?: number };
  };
  website: DossierWebsiteBlock;
  contacts: DossierContactsBlock;
  social: DossierSocialBlock;
  commerce: DossierCommerceBlock;
  google?: DossierGoogleBlock;
  evidence: LeadEvidence[];
  sourcesConsulted: string[];
  sourcesUnavailable: { source: string; error: string }[];
  coverage: EvidenceCoverage;
  generatedAt: string;
  ttlMs: number;
}

export interface DiscoverySummary {
  cacheHit: boolean;
  durationMs: number;
  sourcesAttempted: string[];
  sourcesSucceeded: string[];
  sourcesFailed: { source: string; error: string }[];
  /** Fuentes opcionales que no están configuradas: no son fallos. */
  sourcesSkipped?: { source: string; reason: string }[];
  /** Consultas de búsqueda web efectivamente enviadas. */
  webSearchQueries?: string[];
  /** Resultados de búsqueda evaluados, aceptados y rechazados por correlación. */
  searchResults?: {
    queries: number;
    evaluated: number;
    accepted: number;
    rejected: number;
    ambiguous: number;
  };
  coverageBefore: EvidenceCoverage;
  coverageAfter: EvidenceCoverage;
  identity?: IdentityMatchSummary | null;
  conflicts: string[];
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
  /** Fase 3 */
  discovery?: DiscoverySummary;
  dossier?: BusinessDossier;
  coverageBefore?: EvidenceCoverage;
  coverageAfter?: EvidenceCoverage;
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
  /** Fase 3: descubrimiento digital previo a la decisión. */
  discovery?: DiscoverySummary;
  finalStage: OpportunityResult["stage"];
  errors: string[];
  durationMs: number;
}
