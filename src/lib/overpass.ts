import { fetchWithRetry } from "./fetch-helper";

/**
 * Cliente de Overpass API (OpenStreetMap).
 *
 * Contrato tomado de la documentación oficial:
 *  - Endpoint público: https://overpass-api.de/api/interpreter
 *  - Se envía por POST con el cuerpo `data=<query URL-encoded>`
 *  - La consulta empieza con ajustes: [out:json][timeout:25];
 *  - `out center tags` devuelve el centro de ways/relations y sus etiquetas
 *  - Los límites de uso de las instancias públicas son ~10.000 consultas/día
 *    y piden no utilizarlas para scraping masivo.
 *
 * Acá se usa siempre con un bounding box explícito y un tope de resultados,
 * para no pedir "Argentina completa" ni consultas gigantes.
 */

export const OVERPASS_ENDPOINT =
  process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassOutcome {
  ok: boolean;
  elements: OverpassElement[];
  query: string;
  endpoint: string;
  durationMs: number;
  error?: string;
}

/**
 * Consulta alternativa por nombre de área, sin depender de un geocodificador.
 * Ver documentación de Overpass QL: area[...] -> .searchArea y luego filtros
 * por área.
 */
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
    '"]->.searchArea;\n' +
    "(\n" +
    parts.join("\n") +
    "\n);\n" +
    "out center tags " +
    String(Math.max(1, Math.min(maxElements, 500))) +
    ";"
  );
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OverpassOptions {
  timeoutMs?: number;
  maxElements?: number;
  endpoint?: string;
  /** Inyectable para tests (por defecto usa fetchWithRetry). */
  requestImpl?: typeof fetchWithRetry;
}

function formatTag(key: string, value: string): string {
  return '"' + key + '"="' + value + '"';
}

/**
 * Construye la consulta para una categoría dentro de un bounding box.
 * Se usa la unión de node/way/relation (compatible con cualquier versión) y
 * `out center tags` con tope de resultados.
 */
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
    "[out:json][timeout:25];\n" +
    "(\n" +
    parts.join("\n") +
    "\n);\n" +
    "out center tags " +
    String(Math.max(1, Math.min(maxElements, 500))) +
    ";"
  );
}

/** Ejecuta una consulta Overpass. Nunca lanza: devuelve el error controlado. */
export async function queryOverpass(
  query: string,
  options: OverpassOptions = {},
): Promise<OverpassOutcome> {
  const endpoint = options.endpoint || OVERPASS_ENDPOINT;
  const requestImpl = options.requestImpl || fetchWithRetry;
  const started = Date.now();
  try {
    const response = await requestImpl(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          // Overpass rechaza (406) los clientes que no se identifican.
          "User-Agent": "SaaSHub/1.0 (lead discovery; OpenStreetMap data)",
        },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(options.timeoutMs ?? 40_000),
      },
      1,
      500,
    );
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 200);
      return {
        ok: false,
        elements: [],
        query,
        endpoint,
        durationMs: Date.now() - started,
        error: "Overpass respondió " + response.status + ": " + detail,
      };
    }
    const payload = (await response.json()) as { elements?: OverpassElement[] };
    return {
      ok: true,
      elements: Array.isArray(payload.elements) ? payload.elements : [],
      query,
      endpoint,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      elements: [],
      query,
      endpoint,
      durationMs: Date.now() - started,
      error:
        "No se pudo consultar Overpass: " +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

export interface GeocodedArea {
  displayName: string;
  boundingBox: BoundingBox;
  lat?: number;
  lon?: number;
}

/**
 * Resuelve una zona a un bounding box usando Nominatim (el mismo servicio que
 * ya usa el buscador de prospectos). Sin resultado no se inventa geografía.
 */
export async function geocodeArea(
  place: string,
  options: { timeoutMs?: number; requestImpl?: typeof fetchWithRetry } = {},
): Promise<{ ok: boolean; area?: GeocodedArea; error?: string }> {
  const requestImpl = options.requestImpl || fetchWithRetry;
  const url =
    "https://nominatim.openstreetmap.org/search?q=" +
    encodeURIComponent(place) +
    "&format=json&limit=10";
  // La política de uso de Nominatim exige un User-Agent que identifique la app.
  const headers = {
    "User-Agent": "SaaSHub/1.0 (lead discovery; OpenStreetMap data)",
    "Accept-Language": "es",
    Accept: "application/json",
  };
  try {
    const response = await requestImpl(
      url,
      { method: "GET", headers, signal: AbortSignal.timeout(options.timeoutMs ?? 20_000) },
      1,
      400,
    );
    if (!response.ok) {
      return {
        ok: false,
        error:
          "Nominatim respondió " +
          response.status +
          ". Su política de uso exige identificarse y limita el uso intensivo.",
      };
    }
    const results = (await response.json()) as {
      display_name?: string;
      lat?: string;
      lon?: string;
      class?: string;
      type?: string;
      boundingbox?: [string, string, string, string];
    }[];
    const withBox = results.filter((item) => Array.isArray(item.boundingbox));
    if (!withBox.length) {
      return { ok: false, error: "No se encontró la zona indicada: " + place + "." };
    }
    const boxOf = (item: (typeof withBox)[number]) => {
      const [south, north, west, east] = (item.boundingbox || []).map((value) =>
        Number.parseFloat(value),
      );
      return { south, north, west, east };
    };
    const sizeOf = (box: { south: number; north: number; west: number; east: number }) =>
      Math.abs(box.north - box.south) * Math.abs(box.east - box.west);
    // Se elige el bounding box más grande: un límite administrativo (ciudad o
    // municipio) siempre ocupa más que una calle o un punto de interés que
    // coincide casualmente con el texto buscado.
    const pool = withBox;
    let chosen: { item: (typeof withBox)[number]; box: { south: number; north: number; west: number; east: number } } | null = null;
    for (const item of pool) {
      const box = boxOf(item);
      if (!chosen || sizeOf(box) > sizeOf(chosen.box)) chosen = { item, box };
    }
    if (!chosen) {
      return { ok: false, error: "No se encontró la zona indicada: " + place + "." };
    }
    if (
      ![chosen.box.south, chosen.box.north, chosen.box.west, chosen.box.east].every((value) =>
        Number.isFinite(value),
      )
    ) {
      return { ok: false, error: "La zona indicada no tiene bounding box válido." };
    }
    return {
      ok: true,
      area: {
        displayName: chosen.item.display_name || place,
        boundingBox: chosen.box,
        lat: chosen.item.lat ? Number.parseFloat(chosen.item.lat) : undefined,
        lon: chosen.item.lon ? Number.parseFloat(chosen.item.lon) : undefined,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: "No se pudo resolver la zona: " + (error instanceof Error ? error.message : String(error)),
    };
  }
}
