import { fetchWithRetry } from "./fetch-helper";

/**
 * Cliente de Overpass API (OpenStreetMap) con resiliencia entre instancias.
 *
 * Contrato según la documentación oficial:
 *  - Endpoint: POST a <instancia>/api/interpreter con cuerpo `data=<query>`.
 *  - La consulta empieza con ajustes: [out:json][timeout:25];
 *  - `out center tags` devuelve centro de ways/relations y etiquetas.
 *
 * Política de uso (somos clientes de infraestructura pública, gratuita):
 *  - Pocas consultas, sin paralelismo, fallback SECUENCIAL y presupuesto acotado.
 *  - Nunca se registran secretos (no hay ninguno).
 *  - Solo instancias públicas legítimas; ninguna con TLS inválido.
 */

export const OVERPASS_DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";

/**
 * Respaldos públicos verificados (respondieron HTTP 200 + JSON con una
 * consulta real desde esta máquina). Se excluyen instancias con certificado
 * vencido (overpass.osm.jp) y las que no respondieron (overpass.kumi.systems).
 */
export const OVERPASS_FALLBACK_ENDPOINTS = ["https://overpass.private.coffee/api/interpreter"];

/** Instancias en orden: la configurada primero, luego los respaldos. */
export function overpassEndpoints(configured?: string): string[] {
  const list = [
    configured || process.env.OVERPASS_URL || "",
    OVERPASS_DEFAULT_ENDPOINT,
    ...OVERPASS_FALLBACK_ENDPOINTS,
  ];
  return [...new Set(list.map((item) => (item || "").trim()).filter(Boolean))];
}

/** Lado máximo permitido de la ventana de búsqueda (≈27 km). */
export const MAX_BBOX_DEGREES = 0.25;

/** Radio por defecto para descubrimiento comercial, en kilómetros. */
export const DEFAULT_RADIUS_KM = 10;

/** Radios permitidos internamente. */
export const ALLOWED_RADIUS_KM = [5, 10, 20, 25];

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OverpassAttempt {
  endpoint: string;
  durationMs: number;
  status?: number;
  error?: string;
  outcome: "ok" | "empty" | "failover" | "stop";
}

export interface OverpassOutcome {
  ok: boolean;
  elements: OverpassElement[];
  endpoint?: string;
  query: string;
  durationMs: number;
  attempts: OverpassAttempt[];
  error?: string;
}

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassOptions {
  timeoutMs?: number;
  maxElements?: number;
  endpoint?: string;
  /** Presupuesto total para toda la operación (todos los intentos). */
  budgetMs?: number;
  /** Inyectable para tests (por defecto usa fetchWithRetry). */
  requestImpl?: typeof fetchWithRetry;
}

function formatTag(key: string, value: string): string {
  return '"' + key + '"="' + value + '"';
}

/** ¿Conviene pasar a la siguiente instancia con este resultado? */
export function shouldFailover(status?: number): boolean {
  if (status === undefined) return true; // error de red o timeout
  if (status === 429) return true;
  if (status >= 500) return true;
  return false; // 400/403 son culpa de la consulta: no tiene sentido reintentar
}

/** Consulta para una categoría dentro de un bounding box acotado. */
export function buildCategoryQuery(
  tags: { key: string; value: string }[],
  area: BoundingBox,
  maxElements = 200,
): string {
  const bbox = [area.south, area.west, area.north, area.east].join(",");
  const parts: string[] = [];
  for (const tag of tags) {
    const filter = "[" + formatTag(tag.key, tag.value) + "]";
    parts.push("  node" + filter + "(" + bbox + ");");
    parts.push("  way" + filter + "(" + bbox + ");");
    parts.push("  relation" + filter + "(" + bbox + ");");
  }
  return (
    "[out:json][timeout:25];\n(\n" +
    parts.join("\n") +
    "\n);\n" +
    "out center tags " +
    String(Math.max(1, Math.min(maxElements, 500))) +
    ";"
  );
}

/** Consulta alternativa por nombre de área (sin geocodificador). */
export function buildAreaQueryByName(
  areaName: string,
  tags: { key: string; value: string }[],
  maxElements = 200,
): string {
  const parts: string[] = [];
  for (const tag of tags) {
    const filter = "[" + formatTag(tag.key, tag.value) + "]";
    parts.push("  node" + filter + "(area.searchArea);");
    parts.push("  way" + filter + "(area.searchArea);");
    parts.push("  relation" + filter + "(area.searchArea);");
  }
  return (
    "[out:json][timeout:25];\n" +
    'area["name"="' +
    areaName.replace(/"/g, "") +
    '"]->.searchArea;\n(\n' +
    parts.join("\n") +
    "\n);\n" +
    "out center tags " +
    String(Math.max(1, Math.min(maxElements, 500))) +
    ";"
  );
}

/** Ventana cuadrada alrededor de un centro, respetando la longitud real. */
export function radiusBoundingBox(
  center: { lat: number; lon: number },
  radiusKm = DEFAULT_RADIUS_KM,
): BoundingBox {
  const radius = Math.max(1, Math.min(radiusKm, 25));
  const latDelta = radius / 111;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const lonDelta = radius / (111 * Math.max(0.2, Math.abs(cosLat)));
  const bbox: BoundingBox = {
    south: center.lat - latDelta,
    north: center.lat + latDelta,
    west: center.lon - lonDelta,
    east: center.lon + lonDelta,
  };
  return bbox;
}

/** Dimensiones aproximadas de un bbox, en kilómetros. */
export function bboxDimensions(box: BoundingBox): { heightKm: number; widthKm: number } {
  const heightKm = Math.abs(box.north - box.south) * 111;
  const centerLat = (box.north + box.south) / 2;
  const widthKm = Math.abs(box.east - box.west) * 111 * Math.abs(Math.cos((centerLat * Math.PI) / 180));
  return { heightKm: Number(heightKm.toFixed(1)), widthKm: Number(widthKm.toFixed(1)) };
}

async function queryOneEndpoint(
  query: string,
  endpoint: string,
  requestImpl: typeof fetchWithRetry,
  options: OverpassOptions,
): Promise<{ attempt: OverpassAttempt; elements: OverpassElement[]; error?: string }> {
  const started = Date.now();
  try {
    const response = await requestImpl(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "SaaSHub/1.0 (lead discovery; OpenStreetMap data)",
        },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
      },
      1,
      500,
    );
    const status = response.status;
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 160);
      return {
        attempt: {
          endpoint,
          durationMs: Date.now() - started,
          status,
          error: detail,
          outcome: shouldFailover(status) ? "failover" : "stop",
        },
        elements: [],
        error: "Overpass respondió " + status + ": " + detail,
      };
    }
    const payload = (await response.json()) as {
      elements?: OverpassElement[];
      remark?: unknown;
    };
    const elements = Array.isArray(payload.elements) ? payload.elements : [];
    // Overpass informa errores de ejecución (p. ej. tiempo agotado) en `remark`
    // con HTTP 200: una lista vacía así no significa que no haya comercios.
    const runtimeError =
      typeof payload.remark === "string" && /runtime error/i.test(payload.remark)
        ? payload.remark.replace(/\s+/g, " ").slice(0, 160)
        : undefined;
    if (runtimeError && !elements.length) {
      return {
        attempt: {
          endpoint,
          durationMs: Date.now() - started,
          status,
          error: runtimeError,
          outcome: "failover",
        },
        elements: [],
        error: "Overpass no completó la consulta: " + runtimeError,
      };
    }
    return {
      attempt: {
        endpoint,
        durationMs: Date.now() - started,
        status,
        // Resultado parcial: se usa, pero queda constancia del aviso.
        ...(runtimeError ? { error: runtimeError } : {}),
        outcome: elements.length ? "ok" : "empty",
      },
      elements,
    };
  } catch (error) {
    const aborted = error instanceof Error && /abort/i.test(error.name + error.message);
    return {
      attempt: {
        endpoint,
        durationMs: Date.now() - started,
        error: aborted ? "timeout" : error instanceof Error ? error.message : String(error),
        outcome: "failover",
      },
      elements: [],
      error:
        (aborted ? "Overpass agotó el tiempo de espera: " : "No se pudo consultar Overpass: ") +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

/**
 * Ejecuta la consulta probando instancias en orden (secuencial, sin paralelo).
 * Devuelve la primera respuesta útil y el registro de cada intento.
 */
export async function queryOverpass(
  query: string,
  options: OverpassOptions = {},
): Promise<OverpassOutcome> {
  const requestImpl = options.requestImpl || fetchWithRetry;
  const endpoints = options.endpoint
    ? [options.endpoint]
    : overpassEndpoints().slice(0, 3);
  const budgetMs = options.budgetMs ?? 120_000;
  const started = Date.now();
  const attempts: OverpassAttempt[] = [];
  let lastError = "";

  for (const endpoint of endpoints) {
    if (Date.now() - started > budgetMs) {
      attempts.push({ endpoint, durationMs: 0, outcome: "stop", error: "presupuesto agotado" });
      lastError = lastError || "Se agotó el presupuesto de consultas a Overpass.";
      break;
    }
    const result = await queryOneEndpoint(query, endpoint, requestImpl, options);
    attempts.push(result.attempt);
    if (result.elements.length) {
      return {
        ok: true,
        elements: result.elements,
        endpoint,
        query,
        durationMs: Date.now() - started,
        attempts,
      };
    }
    if (result.attempt.outcome === "empty") {
      // La consulta fue válida y no había resultados: no tiene sentido insistir.
      return {
        ok: true,
        elements: [],
        endpoint,
        query,
        durationMs: Date.now() - started,
        attempts,
      };
    }
    if (result.attempt.outcome === "stop") {
      lastError = result.error || lastError;
      break;
    }
    lastError = result.error || lastError;
  }

  return {
    ok: false,
    elements: [],
    query,
    durationMs: Date.now() - started,
    attempts,
    error: lastError || "No se pudo consultar ninguna instancia de Overpass.",
  };
}

/* ------------------------------------------------------------------ */
/* Geocodificación progresiva con puntaje determinista                 */
/* ------------------------------------------------------------------ */

export interface GeocodedArea {
  displayName: string;
  boundingBox: BoundingBox;
  lat?: number;
  lon?: number;
  queryUsed: string;
  class?: string;
  type?: string;
  placeRank?: number;
  importance?: number;
  score: number;
  scoreReasons: string[];
}

interface NominatimResult {
  display_name?: string;
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
  place_rank?: number;
  importance?: number;
  boundingbox?: [string, string, string, string];
}

/** Variantes progresivas: de la más específica a la más general. */
export function locationVariants(location: string): string[] {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const variants: string[] = [parts.join(", ")];
  for (let index = 1; index < parts.length; index += 1) {
    variants.push(parts.slice(index).join(", "));
  }
  return [...new Set(variants.filter(Boolean))];
}

/**
 * Puntaje determinista de adecuación geográfica para una localidad.
 * Prefiere ciudad/pueblo/municipio por sobre calles, avenidas y barrios.
 */
export function scoreLocationResult(result: NominatimResult): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const kind = (result.type || "").toLowerCase();
  const klass = (result.class || "").toLowerCase();
  const placeRank = typeof result.place_rank === "number" ? result.place_rank : undefined;
  const importance = typeof result.importance === "number" ? result.importance : 0;

  const settlementTypes = ["city", "town", "village", "municipality", "hamlet", "administrative"];
  if (klass === "place" && settlementTypes.includes(kind)) {
    score += 50;
    reasons.push("class=place type=" + kind);
  } else if (klass === "boundary" && kind === "administrative") {
    score += 40;
    reasons.push("límite administrativo");
  }
  if (placeRank !== undefined && placeRank >= 10 && placeRank <= 25) {
    score += 15;
    reasons.push("place_rank " + placeRank);
  }
  if (importance) {
    score += Math.round(importance * 10);
    reasons.push("importance " + importance.toFixed(2));
  }
  const isStreet = klass === "highway" || ["road", "street", "avenue", "residential", "footway", "pedestrian"].includes(kind);
  if (isStreet) {
    score -= 40;
    reasons.push("penalizado: vía urbana");
  }
  if (["neighbourhood", "suburb", "quarter"].includes(kind)) {
    score -= 20;
    reasons.push("penalizado: barrio");
  }
  if (result.boundingbox) {
    const [south, north, west, east] = result.boundingbox.map((value) => Number.parseFloat(value));
    const height = Math.abs(north - south);
    const width = Math.abs(east - west);
    if (height < 0.01 && width < 0.01) {
      score -= 25;
      reasons.push("penalizado: extensión diminuta (punto)");
    } else if (height >= 0.03 || width >= 0.03) {
      score += 10;
      reasons.push("extensión de localidad");
    }
  }
  return { score, reasons };
}

/** Umbral mínimo para aceptar una resolución de localidad. */
export const LOCATION_MIN_SCORE = 30;

export interface GeocodeOptions {
  timeoutMs?: number;
  requestImpl?: typeof fetchWithRetry;
  /** Para tests: permite fijar las variantes intentadas. */
  variants?: string[];
}

/**
 * Resuelve una zona probando variantes progresivas y eligiendo el resultado
 * con mejor puntaje determinista (nunca "el bbox más grande" a secas).
 */
export async function geocodeArea(
  place: string,
  options: GeocodeOptions = {},
): Promise<{ ok: boolean; area?: GeocodedArea; error?: string; considered: string[] }> {
  const requestImpl = options.requestImpl || fetchWithRetry;
  const variants = options.variants || locationVariants(place);
  const considered: string[] = [];
  let best: { area: GeocodedArea } | null = null;

  for (const variant of variants) {
    const url =
      "https://nominatim.openstreetmap.org/search?q=" +
      encodeURIComponent(variant) +
      "&format=json&limit=10&addressdetails=1";
    try {
      const response = await requestImpl(
        url,
        {
          method: "GET",
          headers: {
            "User-Agent": "SaaSHub/1.0 (lead discovery; OpenStreetMap data)",
            "Accept-Language": "es",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
        },
        1,
        400,
      );
      if (!response.ok) {
        considered.push(variant + " -> HTTP " + response.status);
        continue;
      }
      const results = (await response.json()) as NominatimResult[];
      considered.push(variant + " -> " + results.length + " resultados");
      for (const result of results) {
        if (!Array.isArray(result.boundingbox)) continue;
        const scored = scoreLocationResult(result);
        const [south, north, west, east] = result.boundingbox.map((value) => Number.parseFloat(value));
        if (![south, north, west, east].every((value) => Number.isFinite(value))) continue;
        const area: GeocodedArea = {
          displayName: result.display_name || variant,
          boundingBox: { south, north, west, east },
          lat: result.lat ? Number.parseFloat(result.lat) : undefined,
          lon: result.lon ? Number.parseFloat(result.lon) : undefined,
          queryUsed: variant,
          class: result.class,
          type: result.type,
          placeRank: result.place_rank,
          importance: result.importance,
          score: scored.score,
          scoreReasons: scored.reasons,
        };
        if (!best || area.score > best.area.score) best = { area };
      }
    } catch (error) {
      considered.push(
        variant + " -> error: " + (error instanceof Error ? error.message : String(error)),
      );
    }
    if (best && best.area.score >= LOCATION_MIN_SCORE) break;
  }

  if (!best) {
    return { ok: false, error: "No se encontró la zona indicada: " + place, considered };
  }
  if (best.area.score < LOCATION_MIN_SCORE) {
    return {
      ok: false,
      error:
        "Ninguna variante resolvió una localidad razonable (mejor candidato: " +
        best.area.displayName.slice(0, 80) +
        " con puntaje " +
        best.area.score +
        ")",
      considered,
    };
  }
  return { ok: true, area: best.area, considered };
}
