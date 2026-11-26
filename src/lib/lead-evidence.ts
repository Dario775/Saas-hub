/**
 * Evidencias de un prospecto.
 *
 * Cada dato relevante para decidir guarda de dónde salió y con qué estado.
 * El sistema nunca presenta una inferencia como hecho ni afirma ausencia:
 * distingue "no se buscó" de "se buscó y no apareció" y marca los conflictos.
 */

export type DataStatus =
  /** Confirmado por la fuente que lo declara (por ejemplo, el sitio del negocio). */
  | "verified"
  /** Encontrado en una fuente consultada. */
  | "found"
  /** Deducido a partir de señales; nunca se presenta como hecho. */
  | "inferred"
  /** Se consultaron las fuentes disponibles y no apareció. */
  | "not_found"
  /** Hay dato pero no sabemos de dónde viene o está incompleto. */
  | "unknown"
  /** Todavía no se buscó. No autoriza a afirmar ausencia. */
  | "not_searched"
  /** Las fuentes consultadas se contradicen o la identidad es ambigua. */
  | "conflicting";

export type EvidenceField =
  | "identity"
  | "name"
  | "category"
  | "address"
  | "zone"
  | "website"
  | "phone"
  | "email"
  | "whatsapp"
  | "contact_form"
  | "instagram"
  | "facebook"
  | "social"
  | "ecommerce"
  | "catalog"
  | "rating"
  | "opening_hours";

export type EvidenceSource =
  | "openstreetmap"
  | "google_places"
  | "website"
  | "web_search"
  | "manual"
  | "derived";

export interface LeadEvidence {
  field: EvidenceField;
  status: DataStatus;
  value?: string | number | boolean | null;
  source: EvidenceSource;
  sourceUrl?: string;
  observedAt: string;
  confidence: number;
  notes?: string;
}

export type EvidenceInput = Omit<LeadEvidence, "observedAt" | "confidence"> & {
  observedAt?: string;
  confidence?: number;
};

const DEFAULT_CONFIDENCE: Record<DataStatus, number> = {
  verified: 1,
  found: 0.9,
  inferred: 0.6,
  conflicting: 0.2,
  not_found: 0.7,
  unknown: 0.3,
  not_searched: 0,
};

const STATUS_RANK: Record<DataStatus, number> = {
  verified: 6,
  found: 5,
  conflicting: 4,
  inferred: 3,
  not_found: 2,
  unknown: 1,
  not_searched: 0,
};

/** Campos que se evalúan al medir cobertura. Única fuente para todo el sistema. */
export const DEFAULT_EVALUATED_FIELDS: EvidenceField[] = [
  "website",
  "phone",
  "email",
  "whatsapp",
  "instagram",
  "facebook",
  "social",
  "ecommerce",
  "catalog",
  "category",
  "address",
  "rating",
];

const FIELD_LABELS: Partial<Record<EvidenceField, string>> = {
  identity: "identidad",
  name: "nombre",
  category: "rubro",
  address: "dirección",
  zone: "zona",
  website: "sitio web",
  phone: "teléfono",
  email: "email",
  whatsapp: "WhatsApp",
  contact_form: "formulario de contacto",
  instagram: "Instagram",
  facebook: "Facebook",
  social: "otras redes",
  ecommerce: "tienda online",
  catalog: "catálogo",
  rating: "puntuación pública",
  opening_hours: "horarios",
};

export const STATUS_LABELS: Record<DataStatus, string> = {
  verified: "Verificado",
  found: "Encontrado",
  inferred: "Inferido",
  conflicting: "Conflictivo",
  not_found: "Buscado, no encontrado",
  unknown: "Desconocido",
  not_searched: "No buscado",
};

export function fieldLabel(field: EvidenceField): string {
  return FIELD_LABELS[field] || field;
}

export function defaultConfidence(status: DataStatus): number {
  return DEFAULT_CONFIDENCE[status];
}

export function makeEvidence(input: EvidenceInput): LeadEvidence {
  return {
    ...input,
    observedAt: input.observedAt || new Date().toISOString(),
    confidence:
      input.confidence === undefined
        ? DEFAULT_CONFIDENCE[input.status]
        : input.confidence,
  };
}

/** Estado resultante de un campo: el de mayor jerarquía entre sus evidencias. */
export function fieldStatus(
  evidence: LeadEvidence[] | undefined,
  field: EvidenceField,
): DataStatus {
  let best: DataStatus = "not_searched";
  for (const item of evidence || []) {
    if (item.field !== field) continue;
    if (STATUS_RANK[item.status] > STATUS_RANK[best]) best = item.status;
  }
  return best;
}

/** Mejor evidencia respaldada para un campo (verified o found). */
export function supportedEvidence(
  evidence: LeadEvidence[] | undefined,
  field: EvidenceField,
): LeadEvidence | undefined {
  const status = fieldStatus(evidence, field);
  if (status !== "verified" && status !== "found") return undefined;
  return [...(evidence || [])]
    .filter((item) => item.field === field && item.status === status)
    .sort((a, b) => b.confidence - a.confidence)[0];
}

/** true solo si el dato está respaldado (no es inferencia, ni ausencia, ni conflicto). */
export function hasSupportedValue(
  evidence: LeadEvidence[] | undefined,
  field: EvidenceField,
): boolean {
  return Boolean(supportedEvidence(evidence, field));
}

/** Todos los valores respaldados de un campo (por ejemplo varios teléfonos). */
export function supportedValues(
  evidence: LeadEvidence[] | undefined,
  field: EvidenceField,
): string[] {
  const values = (evidence || [])
    .filter(
      (item) =>
        item.field === field &&
        (item.status === "verified" || item.status === "found") &&
        item.value !== undefined &&
        item.value !== null &&
        item.value !== "",
    )
    .map((item) => String(item.value));
  return [...new Set(values)];
}

/** Suma evidencias sin duplicar (mismo campo, estado, valor y fuente). */
export function mergeEvidence(
  current: LeadEvidence[] | undefined,
  incoming: LeadEvidence[],
): LeadEvidence[] {
  const result = [...(current || [])];
  const key = (item: LeadEvidence) =>
    [item.field, item.status, item.source, String(item.value ?? ""), item.sourceUrl || ""].join("|");
  const seen = new Set(result.map(key));
  for (const item of incoming) {
    const itemKey = key(item);
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    result.push(item);
  }
  return result;
}

/**
 * Frase honesta sobre un campo. Nunca afirma que un dato no existe:
 * distingue "no encontramos" de "no se buscó" y avisa cuando hay conflicto.
 */
export function describeFieldStatus(
  evidence: LeadEvidence[] | undefined,
  field: EvidenceField,
  consulted: string[] = [],
): string {
  const status = fieldStatus(evidence, field);
  const label = fieldLabel(field);
  if (status === "verified" || status === "found") return `${label}: encontrado`;
  if (status === "inferred") return `${label}: inferido, sin confirmar`;
  if (status === "conflicting") return `${label}: datos en conflicto, requiere revisión`;
  if (status === "unknown") return `${label}: sin datos`;
  if (status === "not_found") {
    return consulted.length
      ? `${label}: no encontrado en las fuentes consultadas (${consulted.join(", ")})`
      : `${label}: no encontrado en las fuentes consultadas`;
  }
  return `${label}: no se buscó todavía`;
}

export interface EvidenceCoverage {
  /** Respaldo: campos con evidencia verificada o encontrada / campos evaluados. */
  score: number;
  supported: number;
  searched: number;
  notFound: number;
  notSearched: number;
  inferred: number;
  conflicting: number;
  unknown: number;
  total: number;
  fields: Record<string, DataStatus>;
  formula: string;
}

const COVERAGE_FORMULA =
  "score = campos con evidencia verificada o encontrada / campos evaluados. searched = campos evaluados con alguna consulta (todo menos no buscado). No mide la calidad del negocio, solo cuánto sabemos.";

/**
 * Cobertura de evidencia.
 *
 * Es una medida interna nuestra, no un valor que devuelva un modelo:
 * cuenta cuántos de los campos evaluados están respaldados por evidencia
 * (verified o found). Los campos inferidos, ausentes, conflictivos o no
 * consultados no suman, para no premiar conclusiones sin respaldo.
 */
export function evidenceCoverage(
  evidence: LeadEvidence[] | undefined,
  fields: EvidenceField[],
): EvidenceCoverage {
  const statuses: Record<string, DataStatus> = {};
  let supported = 0;
  let searched = 0;
  let notFound = 0;
  let notSearched = 0;
  let inferred = 0;
  let conflicting = 0;
  let unknown = 0;

  for (const field of fields) {
    const status = fieldStatus(evidence, field);
    statuses[field] = status;
    if (status === "verified" || status === "found") supported += 1;
    if (status !== "not_searched") searched += 1;
    if (status === "not_found") notFound += 1;
    if (status === "not_searched") notSearched += 1;
    if (status === "inferred") inferred += 1;
    if (status === "conflicting") conflicting += 1;
    if (status === "unknown") unknown += 1;
  }

  return {
    score: fields.length ? Number((supported / fields.length).toFixed(2)) : 0,
    supported,
    searched,
    notFound,
    notSearched,
    inferred,
    conflicting,
    unknown,
    total: fields.length,
    fields: statuses,
    formula: COVERAGE_FORMULA,
  };
}

/** Líneas de evidencia para prompts o interfaces. */
export function renderEvidenceLines(evidence: LeadEvidence[] | undefined): string[] {
  return (evidence || []).map((item) => {
    const parts = [`${item.field}: ${item.status}`];
    if (item.value !== undefined && item.value !== null && item.value !== "") {
      parts.push(`valor=${String(item.value)}`);
    }
    parts.push(`fuente=${item.source}`);
    if (item.sourceUrl) parts.push(`url=${item.sourceUrl}`);
    parts.push(`confianza=${item.confidence}`);
    if (item.notes) parts.push(`nota=${item.notes}`);
    return `- ${parts.join(" | ")}`;
  });
}
