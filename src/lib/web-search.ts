/**
 * Búsqueda web general — interfaz desacoplada y opcional.
 *
 * El sistema funciona sin ningún proveedor configurado: en ese caso las
 * consultas devuelven `ok: false` con un motivo claro y Business Discovery
 * continúa con las demás fuentes.
 *
 * Proveedores: ver WEB_SEARCH_ALTERNATIVES. Solo se activa automáticamente
 * SearXNG, y únicamente si el operador define SEARXNG_URL (instancia propia,
 * sin costo y sin clave). No se contrata ni se configura nada por defecto.
 *
 * API de SearXNG usada: GET {base}/search?q=...&format=json
 * (documentada en https://docs.searxng.org/dev/search_api.html)
 */

export interface WebSearchItem {
  title: string;
  url: string;
  snippet?: string;
}

export interface WebSearchOutcome {
  ok: boolean;
  provider?: string;
  items: WebSearchItem[];
  error?: string;
}

export interface WebSearchProvider {
  id: string;
  label: string;
  requiresKey: boolean;
  search(query: string, options?: { timeoutMs?: number; limit?: number }): Promise<WebSearchOutcome>;
}

export interface WebSearchAlternative {
  id: string;
  label: string;
  cost: string;
  requiresKey: boolean;
  docs: string;
  note: string;
}

/** Alternativas conocidas. Ninguna viene contratada ni configurada. */
export const WEB_SEARCH_ALTERNATIVES: WebSearchAlternative[] = [
  {
    id: "searxng",
    label: "SearXNG autoalojado",
    cost: "gratis (servidor propio)",
    requiresKey: false,
    docs: "https://docs.searxng.org/dev/search_api.html",
    note: "Única opción que se activa automáticamente: basta definir SEARXNG_URL.",
  },
  {
    id: "brave",
    label: "Brave Search API",
    cost: "pago (plan gratuito limitado)",
    requiresKey: true,
    docs: "https://api-dashboard.search.brave.com/app/documentation",
    note: "Requiere contratar y guardar una clave; no implementado.",
  },
  {
    id: "google-cse",
    label: "Google Programmable Search (Custom Search JSON API)",
    cost: "pago (100 consultas/día gratis)",
    requiresKey: true,
    docs: "https://developers.google.com/custom-search/v1/overview",
    note: "Requiere clave y motor de búsqueda; no implementado.",
  },
  {
    id: "serpapi",
    label: "SerpAPI",
    cost: "pago",
    requiresKey: true,
    docs: "https://serpapi.com/search-api",
    note: "Alternativa comercial; no implementado.",
  },
];

export const WEB_SEARCH_DISABLED_MESSAGE =
  "No hay proveedor de búsqueda web configurado. Definí SEARXNG_URL con una instancia propia para habilitarlo.";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Proveedor SearXNG (solo si SEARXNG_URL está definido). */
export function createSearxngProvider(baseUrl: string): WebSearchProvider {
  const base = stripTrailingSlash(baseUrl.trim());
  return {
    id: "searxng",
    label: "SearXNG",
    requiresKey: false,
    async search(query, options = {}) {
      const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
      const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&language=es`;
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
        });
        if (!response.ok) {
          return {
            ok: false,
            provider: "searxng",
            items: [],
            error: `SearXNG respondió ${response.status}.`,
          };
        }
        const data = (await response.json()) as { results?: Record<string, unknown>[] };
        const items = (data.results || [])
          .slice(0, limit)
          .map((item) => ({
            title: typeof item.title === "string" ? item.title : "",
            url: typeof item.url === "string" ? item.url : "",
            snippet: typeof item.content === "string" ? item.content : undefined,
          }))
          .filter((item) => item.url);
        return { ok: true, provider: "searxng", items };
      } catch (error) {
        return {
          ok: false,
          provider: "searxng",
          items: [],
          error: `SearXNG no respondió: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

export interface PlannedQuery {
  intent: "identidad_ciudad" | "identidad_direccion" | "instagram" | "facebook" | "whatsapp";
  query: string;
}

/**
 * Plan de consultas para un negocio: pocas y orientadas a identidad.
 * Se evita disparar búsquedas de más: máximo 4 por negocio (configurable).
 */
export function buildDiscoveryQueries(
  lead: { nombre?: string; zona?: string; direccion?: string },
  max = 4,
): PlannedQuery[] {
  const name = (lead.nombre || "").trim();
  if (!name) return [];
  const city = (lead.zona || "").split(",")[0].trim();
  const address = (lead.direccion || "").trim();
  const planned: PlannedQuery[] = [
    { intent: "identidad_ciudad", query: '"' + name + '"' + (city ? ' "' + city + '"' : "") },
  ];
  if (address) {
    const street = address.split(",")[0].trim();
    const normalizedName = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const normalizedStreet = street
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    // Si la dirección incluye el nombre del negocio, la consulta sería
    // equivalente a repetir el nombre: se omite.
    const redundant = normalizedStreet.includes(normalizedName) || normalizedName.includes(normalizedStreet);
    if (street && !redundant) {
      planned.push({ intent: "identidad_direccion", query: '"' + name + '" "' + street + '"' });
    }
  }
  planned.push({ intent: "instagram", query: '"' + name + '" instagram' + (city ? " " + city : "") });
  planned.push({ intent: "facebook", query: '"' + name + '" facebook' + (city ? " " + city : "") });
  planned.push({ intent: "whatsapp", query: '"' + name + '" whatsapp' + (city ? " " + city : "") });
  const unique: PlannedQuery[] = [];
  for (const item of planned) {
    if (!unique.some((other) => other.query === item.query)) unique.push(item);
  }
  // Deduplica por texto y por intención: nunca dos consultas equivalentes.
  const byIntent = new Map<string, PlannedQuery>();
  for (const item of unique) {
    if (!byIntent.has(item.intent)) byIntent.set(item.intent, item);
  }
  return [...byIntent.values()].slice(0, Math.max(1, Math.min(max, 5)));
}

/** Devuelve el proveedor configurado, o null si no hay ninguno. */
export function resolveWebSearchProvider(
  env: NodeJS.ProcessEnv = process.env,
): WebSearchProvider | null {
  const base = (env.SEARXNG_URL || "").trim();
  if (!base) return null;
  return createSearxngProvider(base);
}

/** Busca en la web con el proveedor disponible. Nunca lanza. */
export async function searchWeb(
  query: string,
  options: { provider?: WebSearchProvider | null; timeoutMs?: number; limit?: number } = {},
): Promise<WebSearchOutcome> {
  const provider =
    options.provider === undefined ? resolveWebSearchProvider() : options.provider;
  if (!provider) {
    return { ok: false, items: [], error: WEB_SEARCH_DISABLED_MESSAGE };
  }
  if (!query.trim()) {
    return { ok: false, provider: provider.id, items: [], error: "Consulta vacía." };
  }
  return provider.search(query, { timeoutMs: options.timeoutMs, limit: options.limit });
}
