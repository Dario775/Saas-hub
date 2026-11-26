import path from "node:path";
import "server-only";
import { readJson, withFileLock, writeJson } from "./json-store";
import type { OpportunityLogRecord } from "./opportunity-types";

/**
 * Observabilidad del Opportunity Engine.
 *
 * Cada análisis se guarda en un JSON local (mismo mecanismo atómico y con
 * bloqueo que el resto del proyecto) para poder comparar después:
 *   Jev + DeepSeek  vs  DeepSeek solo  vs  modelos locales.
 *
 * Nunca se guardan claves ni cabeceras de autenticación: solo señales,
 * decisiones, modelos y latencias.
 */

const MAX_RECORDS = 500;

export function opportunityLogPath(): string {
  return (
    process.env.OPPORTUNITY_LOG_PATH ||
    path.join(process.cwd(), "leads", "data", "opportunity-analyses.json")
  );
}

export function readOpportunityLog(file?: string): OpportunityLogRecord[] {
  const records = readJson<OpportunityLogRecord[]>(file || opportunityLogPath(), []);
  return Array.isArray(records) ? records : [];
}

/** Agrega un registro. Serializado con bloqueo para no perder análisis simultáneos. */
export async function appendOpportunityLog(
  record: OpportunityLogRecord,
  file?: string,
): Promise<void> {
  const target = file || opportunityLogPath();
  await withFileLock(target, async () => {
    const current = readOpportunityLog(target);
    current.push(record);
    const trimmed =
      current.length > MAX_RECORDS ? current.slice(current.length - MAX_RECORDS) : current;
    writeJson(target, trimmed);
  });
}
