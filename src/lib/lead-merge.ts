import { mergeEvidence } from "./lead-evidence";
import type { LeadItem } from "./leads-service";

/**
 * Fusiona los resultados de una búsqueda con la base existente.
 *
 * Deduplica por id de la fuente y también por identidad de negocio, para que
 * el mismo comercio no se duplique cuando cambia de motor o de identificador.
 * Siempre conserva el progreso comercial (estado, notas, pitch y contacto).
 */
export function mergeLeadSearch(
  existing: LeadItem[],
  found: LeadItem[],
  mode: "replace" | "accumulate",
): LeadItem[] {
  const previous = new Map(existing.map((lead) => [lead.place_id, lead]));
  const byIdentity = new Map<string, LeadItem>();
  for (const lead of existing) {
    if (lead.identity && !byIdentity.has(lead.identity)) byIdentity.set(lead.identity, lead);
  }

  const result = new Map<string, LeadItem>();
  const consumed = new Set<string>();

  for (const lead of found) {
    const old =
      previous.get(lead.place_id) ||
      (lead.identity ? byIdentity.get(lead.identity) : undefined);
    if (old && old.place_id !== lead.place_id) consumed.add(old.place_id);
    result.set(
      lead.place_id,
      old
        ? {
            ...lead,
            status: old.status,
            notes: old.notes,
            customPitch: old.customPitch,
            lastContactedAt: old.lastContactedAt,
            email: lead.email || old.email,
            telefono: lead.telefono || old.telefono,
            identity: lead.identity || old.identity,
            evidence: mergeEvidence(old.evidence, lead.evidence || []),
            opportunity: old.opportunity ?? lead.opportunity ?? null,
          }
        : lead,
    );
  }

  for (const lead of existing) {
    if (consumed.has(lead.place_id)) continue;
    const worked =
      lead.status !== "nuevo" ||
      Boolean(lead.notes || lead.customPitch || lead.lastContactedAt);
    if (!result.has(lead.place_id) && (mode === "accumulate" || worked))
      result.set(lead.place_id, lead);
  }

  return [...result.values()];
}
