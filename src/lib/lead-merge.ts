import type { LeadItem } from "./leads-service";

export function mergeLeadSearch(
  existing: LeadItem[],
  found: LeadItem[],
  mode: "replace" | "accumulate",
): LeadItem[] {
  const previous = new Map(existing.map((lead) => [lead.place_id, lead]));
  const result = new Map<string, LeadItem>();
  for (const lead of found) {
    const old = previous.get(lead.place_id);
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
          }
        : lead,
    );
  }
  for (const lead of existing) {
    const worked =
      lead.status !== "nuevo" ||
      Boolean(lead.notes || lead.customPitch || lead.lastContactedAt);
    if (!result.has(lead.place_id) && (mode === "accumulate" || worked))
      result.set(lead.place_id, lead);
  }
  return [...result.values()];
}
