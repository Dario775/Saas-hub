import { leadIdentity, normalizeIdentityText } from "./lead-identity";
import type { DataStatus } from "./lead-evidence";

/**
 * Correlación de identidad entre un prospecto y un candidato encontrado en
 * otra fuente (Google Places, una página web, un resultado de búsqueda).
 *
 * Encontrar el mismo nombre NO alcanza. Todo se decide por reglas explícitas
 * y deterministas: no hay IA acá y la "confianza" es nuestro propio puntaje
 * normalizado, no una probabilidad de un modelo.
 */

export type IdentityMatchStatus = "matched" | "probable" | "ambiguous" | "rejected";

export interface IdentitySubject {
  nombre?: string;
  direccion?: string;
  zona?: string;
  telefono?: string;
  website?: string;
  rubro?: string;
  lat?: number | string;
  lon?: number | string;
}

export interface IdentityMatchResult {
  status: IdentityMatchStatus;
  score: number;
  /** Puntaje normalizado por reglas: min(1, score / 8), acotado a 0..1. */
  confidence: number;
  matchedSignals: string[];
  conflictingSignals: string[];
  formula: string;
}

export const IDENTITY_MATCH_FORMULA =
  "score por reglas: nombre exacto +3, nombre contenido +2, solapamiento de palabras +1, teléfono coincidente +3, dominio web coincidente +2, distancia <150m +3 / <500m +2 / <2km +1, misma ciudad +1, misma categoría +1, nombre no relacionado -2; distancia >5km rechaza. Estados: matched >=6, probable >=4, ambiguous >=2, rejected <2. confidence = min(1, score/8).";

export const MATCHED_THRESHOLD = 6;
export const PROBABLE_THRESHOLD = 4;
export const AMBIGUOUS_THRESHOLD = 2;
export const HARD_DISTANCE_METERS = 5_000;

export const IDENTITY_STATUS_LABELS: Record<IdentityMatchStatus, string> = {
  matched: "coincide",
  probable: "probable",
  ambiguous: "ambigua",
  rejected: "descartada",
};

/** Estado de evidencia que corresponde a cada resultado de correlación. */
export function identityStatusToEvidence(status: IdentityMatchStatus): DataStatus {
  if (status === "matched") return "verified";
  if (status === "probable") return "found";
  if (status === "ambiguous") return "conflicting";
  return "not_found";
}

/** Dígitos normalizados de un teléfono, sin prefijo internacional ni ceros. */
export function normalizePhoneDigits(raw?: string | null): string {
  const digits = (raw || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  const withoutCountry = digits.replace(/^54/, "").replace(/^9/, "");
  return withoutCountry.replace(/^0+/, "");
}

function phoneMatch(a?: string, b?: string): boolean {
  const left = normalizePhoneDigits(a);
  const right = normalizePhoneDigits(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const size = Math.min(left.length, right.length, 8);
  return size >= 6 && left.slice(-size) === right.slice(-size);
}

function domainOf(raw?: string): string {
  const value = (raw || "").trim();
  if (!value) return "";
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function nameScore(a?: string, b?: string): { score: number; signal?: string; related: boolean } {
  const left = normalizeIdentityText(a);
  const right = normalizeIdentityText(b);
  if (!left || !right) return { score: 0, related: false };
  if (left === right) return { score: 3, signal: "nombre exacto", related: true };
  if (left.includes(right) || right.includes(left))
    return { score: 2, signal: "nombre contenido en el otro", related: true };
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2));
  const rightTokens = right.split(" ").filter((token) => token.length > 2);
  if (!leftTokens.size || !rightTokens.length) return { score: 0, related: false };
  const shared = rightTokens.filter((token) => leftTokens.has(token));
  const ratio = shared.length / Math.min(leftTokens.size, rightTokens.length);
  if (ratio >= 0.6) return { score: 1, signal: "palabras del nombre coincidentes", related: true };
  return { score: 0, related: false };
}

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function coords(subject: IdentitySubject): { lat: number; lon: number } | null {
  const lat = typeof subject.lat === "number" ? subject.lat : Number.parseFloat(String(subject.lat ?? ""));
  const lon = typeof subject.lon === "number" ? subject.lon : Number.parseFloat(String(subject.lon ?? ""));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

/** Compara el prospecto contra un candidato y devuelve un resultado por reglas. */
export function matchBusinessIdentity(
  lead: IdentitySubject,
  candidate: IdentitySubject,
): IdentityMatchResult {
  const matchedSignals: string[] = [];
  const conflictingSignals: string[] = [];
  let score = 0;

  const name = nameScore(lead.nombre, candidate.nombre);
  if (name.signal) matchedSignals.push(name.signal);
  if (!name.related && normalizeIdentityText(lead.nombre) && normalizeIdentityText(candidate.nombre)) {
    score -= 2;
    conflictingSignals.push("nombre no relacionado");
  }
  score += name.score;

  if (phoneMatch(lead.telefono, candidate.telefono)) {
    score += 3;
    matchedSignals.push("teléfono coincidente");
  }

  const leadDomain = domainOf(lead.website);
  const candidateDomain = domainOf(candidate.website);
  if (leadDomain && candidateDomain && leadDomain === candidateDomain) {
    score += 2;
    matchedSignals.push("mismo dominio web");
  }

  const leadCoords = coords(lead);
  const candidateCoords = coords(candidate);
  if (leadCoords && candidateCoords) {
    const distance = haversineMeters(leadCoords, candidateCoords);
    if (distance > HARD_DISTANCE_METERS) {
      conflictingSignals.push(`distancia ${Math.round(distance)} m (más de 5 km)`);
      return {
        status: "rejected",
        score,
        confidence: 0,
        matchedSignals,
        conflictingSignals,
        formula: IDENTITY_MATCH_FORMULA,
      };
    }
    if (distance < 150) {
      score += 3;
      matchedSignals.push("coordenadas a menos de 150 m");
    } else if (distance < 500) {
      score += 2;
      matchedSignals.push("coordenadas a menos de 500 m");
    } else if (distance < 2_000) {
      score += 1;
      matchedSignals.push("coordenadas a menos de 2 km");
    } else {
      conflictingSignals.push(`distancia ${Math.round(distance)} m`);
    }
  }

  const leadAddress = normalizeIdentityText(lead.direccion);
  const candidateAddress = normalizeIdentityText(candidate.direccion);
  if (leadAddress && candidateAddress) {
    const leadNumber = leadAddress.match(/\b\d{2,5}\b/);
    const candidateNumber = candidateAddress.match(/\b\d{2,5}\b/);
    if (leadNumber && candidateNumber && leadNumber[0] === candidateNumber[0]) {
      score += 1;
      matchedSignals.push("mismo número de calle");
    }
  }

  const leadZone = normalizeIdentityText(lead.zona);
  const candidateZone = normalizeIdentityText(`${candidate.zona || ""} ${candidate.direccion || ""}`);
  if (leadZone && candidateZone) {
    const city = leadZone.split(" ").filter((token) => token.length > 3);
    if (city.some((token) => candidateZone.includes(token))) {
      score += 1;
      matchedSignals.push("misma ciudad o zona");
    }
  }

  const leadRubro = normalizeIdentityText(lead.rubro);
  const candidateRubro = normalizeIdentityText(candidate.rubro);
  if (leadRubro && candidateRubro && leadRubro === candidateRubro) {
    score += 1;
    matchedSignals.push("misma categoría");
  }

  const status: IdentityMatchStatus =
    score >= MATCHED_THRESHOLD
      ? "matched"
      : score >= PROBABLE_THRESHOLD
        ? "probable"
        : score >= AMBIGUOUS_THRESHOLD
          ? "ambiguous"
          : "rejected";

  return {
    status,
    score,
    confidence: Number(Math.min(1, Math.max(0, score / 8)).toFixed(2)),
    matchedSignals,
    conflictingSignals,
    formula: IDENTITY_MATCH_FORMULA,
  };
}

/**
 * Reglas de correlación para un resultado de búsqueda (SearXNG).
 * Deterministas y documentadas; el puntaje NO es una confianza de IA.
 */
export const SEARCH_MATCH_FORMULA =
  "score por reglas: nombre en título o snippet +3, nombre en el slug/handle de la URL +2, dirección o número de calle en el texto +2, teléfono del prospecto en el texto o URL +3, misma ciudad en el texto o URL +1, rubro en el texto +1, mismo dominio que el sitio declarado +3; sin señales de identidad se rechaza. Estados: matched >=6, probable >=4, ambiguous >=2, rejected <2. confidence = min(1, score/8).";

/**
 * Ciudades y provincias que, si aparecen en un resultado y NO son las del
 * prospecto, descartan el candidato (evita homónimos de otra provincia).
 */
export const OTHER_PLACES = [
  "tucuman",
  "salto",
  "cordoba",
  "mendoza",
  "rosario",
  "la plata",
  "mar del plata",
  "bahia blanca",
  "quilmes",
  "banfield",
  "laferrere",
  "catamarca",
  "jujuy",
  "neuquen",
  "chaco",
  "misiones",
  "corrientes",
  "santiago del estero",
  "san juan",
  "san luis",
  "entre rios",
  "capital federal",
  "caba",
  "guayaquil",
  "guatemala",
];

export interface SearchResultLike {
  title?: string;
  url: string;
  snippet?: string;
}

export function matchSearchResult(
  lead: IdentitySubject,
  item: SearchResultLike,
): IdentityMatchResult & { accepted: boolean } {
  const matchedSignals: string[] = [];
  const conflictingSignals: string[] = [];
  let score = 0;

  const title = normalizeIdentityText(item.title);
  const snippet = normalizeIdentityText(item.snippet);
  const url = (item.url || "").toLowerCase();
  const text = title + " " + snippet + " " + url;

  // 1) Si el resultado menciona otra ciudad o provincia y NO menciona la
  //    ciudad del prospecto, se descarta. Así no se castiga una calle
  //    homónima (por ejemplo, una calle Tucumán en Salta).
  const zoneText = normalizeIdentityText(lead.zona);
  const ownCityTokens = zoneText
    .split(" ")
    .filter((token) => token.length > 3 && !OTHER_PLACES.includes(token));
  const mentionsOwnCity = ownCityTokens.some((token) => text.includes(token));
  const rival = OTHER_PLACES.find((place) => text.includes(place) && !zoneText.includes(place));
  if (rival && !mentionsOwnCity) {
    return {
      status: "rejected",
      score: 0,
      confidence: 0,
      matchedSignals: [],
      conflictingSignals: ["menciona otra ubicación: " + rival],
      formula: SEARCH_MATCH_FORMULA,
      accepted: false,
    };
  }

  // 2) En redes sociales solo valen perfiles o páginas del negocio: nunca
  //    publicaciones, reels, grupos, hashtags ni páginas de exploración.
  const socialHost = domainOf(item.url);
  if (/instagram|facebook|tiktok|linkedin|youtube|fb[.]com/.test(socialHost)) {
    let pathname = "";
    try {
      pathname = new URL(item.url).pathname;
    } catch {
      pathname = "";
    }
    const notAProfile = new RegExp(
      "(^|/)(p|reel|reels|tv|stories|groups|posts|watch|hashtag|explore|popular|search|share)/",
      "i",
    );
    if (notAProfile.test(pathname + "/")) {
      return {
        status: "rejected",
        score: 0,
        confidence: 0,
        matchedSignals: [],
        conflictingSignals: ["no es un perfil ni una página del negocio"],
        formula: SEARCH_MATCH_FORMULA,
        accepted: false,
      };
    }

    // Además: sin el nombre del negocio presente en el resultado, un perfil
    // no se acepta (no alcanza con que el usuario/handle se parezca).
    // Se calcula acá para no depender de declaraciones posteriores.
    const ownTokens = normalizeIdentityText(lead.nombre)
      .split(" ")
      .filter((token) => token.length >= 4);
    const ownRelevant = ownTokens.filter((token) => token.length >= 5);
    const candidateTokens = ownRelevant.length ? ownRelevant : ownTokens;
    const handleText = normalizeIdentityText(pathname.split("/").join(" "));
    const handleHits = candidateTokens.filter((token) => handleText.includes(token)).length;
    if (candidateTokens.length > 0 && handleHits < candidateTokens.length) {
      return {
        status: "rejected",
        score: 0,
        confidence: 0,
        matchedSignals: [],
        conflictingSignals: ["el perfil no coincide con el nombre del negocio"],
        formula: SEARCH_MATCH_FORMULA,
        accepted: false,
      };
    }
  }

  const nameTokens = normalizeIdentityText(lead.nombre)
    .split(" ")
    .filter((token) => token.length >= 4);
  const relevantTokens = nameTokens.filter((token) => token.length >= 5);
  const tokensInText = (relevantTokens.length ? relevantTokens : nameTokens).filter((token) =>
    text.includes(token),
  );
  const tokenRatio =
    (relevantTokens.length ? relevantTokens : nameTokens).length > 0
      ? tokensInText.length / (relevantTokens.length ? relevantTokens.length : nameTokens.length)
      : 0;
  if (tokensInText.length >= 2 && tokenRatio >= 0.6) {
    score += 3;
    matchedSignals.push("nombre en el título o el resumen");
  }

  // Slug/handle de la URL (por ejemplo instagram.com/<handle>).
  try {
    const parsed = new URL(item.url);
    const slug = normalizeIdentityText(parsed.pathname.replace(/\//g, " "));
    const slugTokens = (relevantTokens.length ? relevantTokens : nameTokens).filter((token) =>
      slug.includes(token),
    );
    const slugRatio =
      (relevantTokens.length ? relevantTokens : nameTokens).length > 0
        ? slugTokens.length / (relevantTokens.length ? relevantTokens.length : nameTokens.length)
        : 0;
    if (slugTokens.length >= 1 && slugRatio >= 0.5 && tokensInText.length < 2) {
      score += 2;
      matchedSignals.push("nombre en la dirección del perfil o página");
    }
  } catch {
    /* URL inválida: se ignora */
  }

  const address = normalizeIdentityText(lead.direccion);
  const addressNumber = address.match(/\b\d{2,5}\b/);
  if (addressNumber && text.includes(addressNumber[0])) {
    score += 2;
    matchedSignals.push("número de calle coincidente");
  }

  const phone = normalizePhoneDigits(lead.telefono);
  if (phone && phone.length >= 6 && text.replace(/[^\d]/g, "").includes(phone.slice(-8))) {
    score += 3;
    matchedSignals.push("teléfono coincidente en el resultado");
  }

  const zone = normalizeIdentityText(lead.zona);
  const zoneTokens = zone.split(" ").filter((token) => token.length > 3);
  if (zoneTokens.length && zoneTokens.some((token) => text.includes(token))) {
    score += 1;
    matchedSignals.push("misma ciudad o zona");
  }

  const rubro = normalizeIdentityText(lead.rubro);
  if (rubro && rubro.length > 4 && text.includes(rubro)) {
    score += 1;
    matchedSignals.push("rubro presente");
  }

  const leadDomain = domainOf(lead.website);
  if (leadDomain && url.includes(leadDomain)) {
    score += 3;
    matchedSignals.push("mismo dominio que el sitio declarado");
  }

  if (!matchedSignals.length) conflictingSignals.push("sin señales de identidad en el resultado");

  const status: IdentityMatchStatus =
    score >= MATCHED_THRESHOLD
      ? "matched"
      : score >= PROBABLE_THRESHOLD
        ? "probable"
        : score >= AMBIGUOUS_THRESHOLD
          ? "ambiguous"
          : "rejected";

  return {
    status,
    score,
    confidence: Number(Math.min(1, Math.max(0, score / 8)).toFixed(2)),
    matchedSignals,
    conflictingSignals,
    formula: SEARCH_MATCH_FORMULA,
    accepted: status === "matched" || status === "probable",
  };
}

/** Identidad propia del prospecto, para comparar contra otros registros. */
export function subjectIdentity(subject: IdentitySubject): string {
  return leadIdentity({
    nombre: subject.nombre,
    direccion: subject.direccion,
    zona: subject.zona,
    lat: subject.lat,
    lon: subject.lon,
  });
}
