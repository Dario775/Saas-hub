import { createHash } from "node:crypto";

/** Normaliza texto para comparar el mismo comercio entre fuentes distintas. */
export function normalizeIdentityText(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function shortHash(input: string, length = 16): string {
  return createHash("sha256").update(input).digest("hex").slice(0, length);
}

function coord(value?: string | number): string {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed.toFixed(5) : "";
}

export interface LeadIdentityInput {
  nombre?: string;
  direccion?: string;
  zona?: string;
  lat?: string | number;
  lon?: string | number;
}

/**
 * Identidad estable de un comercio, independiente del id que use la fuente.
 * Prioriza coordenadas + nombre; sin coordenadas usa nombre + dirección + zona.
 * Nunca usa aleatoriedad: el mismo comercio produce siempre la misma identidad.
 */
export function leadIdentity(input: LeadIdentityInput): string {
  const name = normalizeIdentityText(input.nombre);
  const lat = coord(input.lat);
  const lon = coord(input.lon);
  const parts =
    lat && lon
      ? ["coords", lat, lon, name]
      : [
          "address",
          name,
          normalizeIdentityText(input.direccion),
          normalizeIdentityText(input.zona),
        ];
  return `idn_${shortHash(parts.join("|"))}`;
}

export interface OsmPlaceLike {
  osm_type?: string;
  osm_id?: string | number;
  place_id?: string | number;
  lat?: string | number;
  lon?: string | number;
  name?: string;
  display_name?: string;
}

function present(value?: string | number | null): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

/**
 * Identificador determinista para un comercio de OpenStreetMap/Nominatim.
 * Orden de preferencia: osm_type + osm_id, place_id, y por último un hash
 * estable de los datos disponibles (nombre, dirección y coordenadas).
 */
export function osmPlaceId(place: OsmPlaceLike): string {
  const type = present(place.osm_type).toLowerCase();
  const osmId = present(place.osm_id);
  if (type && osmId) return `osm:${type}/${osmId}`;

  const placeId = present(place.place_id);
  if (placeId) return `osm:place/${placeId}`;

  return `osm:hash/${shortHash(
    [
      normalizeIdentityText(place.name),
      normalizeIdentityText(place.display_name),
      coord(place.lat),
      coord(place.lon),
    ].join("|"),
  )}`;
}

/** Identidad derivada de un comercio de OSM, para deduplicar entre motores. */
export function osmPlaceIdentity(place: OsmPlaceLike): string {
  return leadIdentity({
    nombre: place.name || (place.display_name || "").split(",")[0],
    direccion: place.display_name,
    lat: place.lat,
    lon: place.lon,
  });
}
