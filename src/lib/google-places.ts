import { fetchWithRetry } from "./fetch-helper";

/**
 * Google Places — reutilizado desde la capacidad que ya existía en el
 * proyecto (búsqueda de texto de Places API "New" con respaldo en la API
 * legacy). Acá se expone como módulo desacoplado para Business Discovery.
 *
 * Contrato oficial (docs de Google):
 *  - Places API (New): POST https://places.googleapis.com/v1/places:searchText
 *      headers: X-Goog-Api-Key, X-Goog-FieldMask
 *      body:    { textQuery, languageCode, maxResultCount, locationBias }
 *  - Places API legacy: GET https://maps.googleapis.com/maps/api/place/textsearch/json
 *  - Detalles legacy:   GET https://maps.googleapis.com/maps/api/place/details/json
 *
 * La clave sale de GOOGLE_PLACES_KEY (o se pasa explícitamente). Nunca se
 * registra ni se devuelve.
 */

export const PLACES_NEW_URL = "https://places.googleapis.com/v1/places:searchText";
export const PLACES_LEGACY_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
export const PLACE_DETAILS_LEGACY_URL = "https://maps.googleapis.com/maps/api/place/details/json";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.primaryType",
  "places.types",
  "places.googleMapsUri",
  "places.location",
].join(",");

/** Candidato normalizado, con los datos que la API entrega y nada inventado. */
export interface PlacesCandidate {
  placeId: string;
  name: string;
  address?: string;
  lat?: number;
  lon?: number;
  phone?: string;
  website?: string;
  /** Puntuación real informada por Google; se omite si la API no la da. */
  rating?: number;
  ratingCount?: number;
  businessStatus?: string;
  primaryType?: string;
  types?: string[];
  mapsUri?: string;
}

export interface PlacesSearchResult {
  ok: boolean;
  engine?: "places_new" | "places_legacy";
  candidates: PlacesCandidate[];
  usage?: { requests: number };
  error?: string;
}

export interface PlacesOptions {
  apiKey?: string;
  query: string;
  lat?: string | number;
  lon?: string | number;
  radiusMeters?: number;
  maxResults?: number;
  timeoutMs?: number;
  /** Inyectable para tests; por defecto usa fetchWithRetry. */
  requestImpl?: typeof fetchWithRetry;
}

export function resolvePlacesKey(explicit?: string): string {
  return (explicit ?? process.env.GOOGLE_PLACES_KEY ?? "").trim();
}

export function placesConfigured(explicit?: string): boolean {
  return resolvePlacesKey(explicit).length >= 10;
}

function toNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function fromNewPlace(place: Record<string, unknown>): PlacesCandidate | null {
  const id = typeof place.id === "string" ? place.id : "";
  if (!id) return null;
  const displayName = place.displayName as { text?: string } | string | undefined;
  const name =
    typeof displayName === "string" ? displayName : displayName?.text || "";
  const location = place.location as { latitude?: number; longitude?: number } | undefined;
  const types = Array.isArray(place.types) ? place.types.map((item) => String(item)) : undefined;
  return {
    placeId: id,
    name,
    address: typeof place.formattedAddress === "string" ? place.formattedAddress : undefined,
    lat: toNumber(location?.latitude),
    lon: toNumber(location?.longitude),
    phone:
      (typeof place.internationalPhoneNumber === "string" && place.internationalPhoneNumber) ||
      (typeof place.nationalPhoneNumber === "string" && place.nationalPhoneNumber) ||
      undefined,
    website: typeof place.websiteUri === "string" ? place.websiteUri : undefined,
    rating: toNumber(place.rating),
    ratingCount: toNumber(place.userRatingCount),
    businessStatus:
      typeof place.businessStatus === "string" ? place.businessStatus : undefined,
    primaryType: typeof place.primaryType === "string" ? place.primaryType : undefined,
    types,
    mapsUri: typeof place.googleMapsUri === "string" ? place.googleMapsUri : undefined,
  };
}

function fromLegacyResult(place: Record<string, unknown>): PlacesCandidate | null {
  const id = typeof place.place_id === "string" ? place.place_id : "";
  if (!id) return null;
  const geometry = place.geometry as { location?: { lat?: number; lng?: number } } | undefined;
  const types = Array.isArray(place.types) ? place.types.map((item) => String(item)) : undefined;
  return {
    placeId: id,
    name: typeof place.name === "string" ? place.name : "",
    address: typeof place.formatted_address === "string" ? place.formatted_address : undefined,
    lat: toNumber(geometry?.location?.lat),
    lon: toNumber(geometry?.location?.lng),
    rating: toNumber(place.rating),
    ratingCount: toNumber(place.user_ratings_total),
    businessStatus: typeof place.business_status === "string" ? place.business_status : undefined,
    primaryType: types && types.length ? types[0] : undefined,
    types,
    mapsUri: `https://www.google.com/maps/place/?q=place_id:${id}`,
  };
}

/** Detalles legacy, solo para completar teléfono o sitio cuando faltan. */
async function legacyDetails(
  apiKey: string,
  placeId: string,
  requestImpl: typeof fetchWithRetry,
): Promise<{ phone?: string; website?: string }> {
  const url =
    `${PLACE_DETAILS_LEGACY_URL}?place_id=${encodeURIComponent(placeId)}` +
    `&fields=formatted_phone_number,international_phone_number,website&key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await requestImpl(url, { method: "GET" }, 1, 300);
    if (!response.ok) return {};
    const data = (await response.json()) as { result?: Record<string, unknown> };
    const result = data.result || {};
    return {
      phone:
        (typeof result.international_phone_number === "string" &&
          result.international_phone_number) ||
        (typeof result.formatted_phone_number === "string" && result.formatted_phone_number) ||
        undefined,
      website: typeof result.website === "string" ? result.website : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Busca un comercio por texto. Intenta la API nueva y cae a la legacy,
 * igual que hacía el buscador de prospectos.
 */
export async function searchPlaces(options: PlacesOptions): Promise<PlacesSearchResult> {
  const apiKey = resolvePlacesKey(options.apiKey);
  if (apiKey.length < 10) {
    return {
      ok: false,
      candidates: [],
      error: "Falta GOOGLE_PLACES_KEY: Google Places no está configurado.",
    };
  }

  const requestImpl = options.requestImpl || fetchWithRetry;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxResults = Math.min(Math.max(options.maxResults ?? 5, 1), 20);
  const lat = toNumber(options.lat);
  const lon = toNumber(options.lon);
  const hasCoords = lat !== undefined && lon !== undefined;
  let requests = 0;
  let lastError = "";

  try {
    requests += 1;
    const body: Record<string, unknown> = {
      textQuery: options.query,
      languageCode: "es",
      maxResultCount: maxResults,
    };
    if (hasCoords) {
      body.locationBias = {
        circle: {
          center: { latitude: lat, longitude: lon },
          radius: Math.min(Math.max(options.radiusMeters ?? 15_000, 100), 50_000),
        },
      };
    }
    const response = await requestImpl(
      PLACES_NEW_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      },
      1,
      400,
    );
    const data = (await response.json()) as {
      places?: Record<string, unknown>[];
      error?: { message?: string; status?: string };
    };
    if (response.ok && !data.error) {
      const candidates = (data.places || [])
        .map(fromNewPlace)
        .filter((item): item is PlacesCandidate => item !== null);
      return { ok: true, engine: "places_new", candidates, usage: { requests } };
    }
    lastError = data.error?.message || data.error?.status || `HTTP ${response.status}`;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  try {
    requests += 1;
    const legacyQuery = hasCoords
      ? `${PLACES_LEGACY_URL}?query=${encodeURIComponent(options.query)}&location=${lat},${lon}&radius=15000&key=${encodeURIComponent(apiKey)}`
      : `${PLACES_LEGACY_URL}?query=${encodeURIComponent(options.query)}&key=${encodeURIComponent(apiKey)}`;
    const response = await requestImpl(
      legacyQuery,
      { method: "GET", signal: AbortSignal.timeout(timeoutMs) },
      1,
      400,
    );
    const data = (await response.json()) as {
      status?: string;
      error_message?: string;
      results?: Record<string, unknown>[];
    };
    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      const candidates = (data.results || [])
        .slice(0, maxResults)
        .map(fromLegacyResult)
        .filter((item): item is PlacesCandidate => item !== null);
      // Completar teléfono/sitio faltantes con Details (máximo 2 para no gastar de más).
      const incomplete = candidates.filter((item) => !item.phone || !item.website).slice(0, 2);
      for (const candidate of incomplete) {
        requests += 1;
        const extra = await legacyDetails(apiKey, candidate.placeId, requestImpl);
        candidate.phone = candidate.phone || extra.phone;
        candidate.website = candidate.website || extra.website;
      }
      return { ok: true, engine: "places_legacy", candidates, usage: { requests } };
    }
    return {
      ok: false,
      candidates: [],
      usage: { requests },
      error: `Google Places respondió ${data.status || "ERROR"}: ${data.error_message || lastError || "sin detalle"}`,
    };
  } catch (error) {
    return {
      ok: false,
      candidates: [],
      usage: { requests },
      error: `Google Places no respondió: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
