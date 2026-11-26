import type { DiscoveryResult } from "@/lib/lead-discovery";

type Attempt = NonNullable<DiscoveryResult["overpass"]>["attempts"][number];

interface DiscoveryDetailsProps {
  geocode?: DiscoveryResult["geocode"];
  overpass?: DiscoveryResult["overpass"];
}

const OUTCOME_LABELS: Record<string, string> = {
  ok: "respondió",
  empty: "sin comercios",
  failover: "falló, se probó el siguiente",
  stop: "detenido",
};

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

function seconds(ms: number): string {
  return (ms / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " s";
}

function describeAttempt(attempt: Attempt): string {
  return [
    OUTCOME_LABELS[attempt.outcome] || attempt.outcome,
    attempt.status ? "HTTP " + attempt.status : "",
    seconds(attempt.durationMs),
    attempt.error || "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Cómo se resolvió la zona y qué servidores se consultaron. */
export function DiscoveryDetails({ geocode, overpass }: DiscoveryDetailsProps) {
  if (!geocode && !overpass) return null;
  return (
    <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-white/10 bg-black/30 p-3 text-xs sm:grid-cols-[8rem_1fr]">
      {geocode && (
        <>
          <dt className="text-slate-400">Zona resuelta</dt>
          <dd className="text-slate-200 break-words">{geocode.displayName}</dd>
          <dt className="text-slate-400">Área buscada</dt>
          <dd className="text-slate-200">
            Radio de {geocode.radiusKm} km ({geocode.dimensionsKm.widthKm} ×{" "}
            {geocode.dimensionsKm.heightKm} km) ·{" "}
            <a
              className="text-cyan-300 underline underline-offset-2"
              href={`https://www.openstreetmap.org/?mlat=${geocode.center.lat}&mlon=${geocode.center.lon}#map=12/${geocode.center.lat}/${geocode.center.lon}`}
              target="_blank"
              rel="noreferrer"
            >
              ver centro en el mapa
            </a>
          </dd>
          <dt className="text-slate-400">Puntaje de zona</dt>
          <dd className="text-slate-200 break-words">
            {geocode.score} · {geocode.scoreReasons.join(", ")}
          </dd>
          <dt className="text-slate-400">Textos probados</dt>
          <dd className="text-slate-200 break-words">{geocode.consideredVariants.join(" | ")}</dd>
        </>
      )}
      {overpass && (
        <>
          <dt className="text-slate-400">Servidores</dt>
          <dd className="text-slate-200">
            <ul className="space-y-1">
              {overpass.attempts.map((attempt, index) => (
                <li key={`${attempt.endpoint}-${index}`} className="break-words">
                  <strong className="font-semibold">{hostOf(attempt.endpoint)}</strong>:{" "}
                  {describeAttempt(attempt)}
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
    </dl>
  );
}
