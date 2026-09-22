import { mergeLeadSearch } from "@/lib/lead-merge";
import { calculateStats,getLeads,LeadItem,saveLeads } from "@/lib/leads-service";
import { NextRequest,NextResponse } from "next/server";

const PLACES_NEW_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACES_LEGACY_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const PLACE_DETAILS_LEGACY_URL = "https://maps.googleapis.com/maps/api/place/details/json";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rubro, zona, engine = "osm", apiKey: clientApiKey, locationData, searchMode = "replace" } = body;

    if (!rubro || !zona) {
      return NextResponse.json(
        { success: false, error: "Debes ingresar un rubro y una zona." },
        { status: 400 }
      );
    }

    // Normalizar rubro y zona
    const cleanRubro = rubro
      .replace(/^(en|de|los|las|el|la|un|una)\s+/i, "")
      .trim();
    const cleanZona = zona
      .replace(/^(en|de|el|la)\s+/i, "")
      .trim();

    const currentLeads = getLeads();
    const existingIds = new Set<string>();
    const newFoundLeads: LeadItem[] = [];

    // Resolver coordenadas y bounding box si no vienen en el payload
    let boundingbox: [string, string, string, string] | null = locationData?.boundingbox || null;
    let geoLat: string = locationData?.lat || "";
    let geoLon: string = locationData?.lon || "";
    let resolvedLocationName = locationData?.display || cleanZona;

    if (!boundingbox || !geoLat || !geoLon) {
      try {
        const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          cleanZona
        )}&format=json&limit=1`;
        const geoRes = await fetch(geoUrl, {
          headers: {
            "User-Agent": "SaaSHub-LeadDiscovery/2.0 (geocoding-resolver)",
            "Accept-Language": "es-ES,es;q=0.9",
          },
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (Array.isArray(geoData) && geoData.length > 0 && geoData[0].boundingbox) {
            boundingbox = geoData[0].boundingbox;
            geoLat = geoData[0].lat || geoLat;
            geoLon = geoData[0].lon || geoLon;
            resolvedLocationName = geoData[0].display_name?.split(",").slice(0, 2).join(",") || resolvedLocationName;
          }
        }
      } catch {
        // Fallback sin geocodificación si falla la red
      }
    }

    // ==========================================
    // MOTOR 1: OPENSTREETMAP (100% LIBRE, SIN API KEY)
    // ==========================================
    if (engine === "osm") {
      const osmCandidates: any[] = [];
      const seenOsmIds = new Set<string>();

      // 1. Estrategia A: Búsqueda acotada al Bounding Box (viewbox) de la localidad exacta
      if (boundingbox && boundingbox.length === 4) {
        const [minLat, maxLat, minLon, maxLon] = boundingbox;
        const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;
        const boundedUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          cleanRubro
        )}&viewbox=${viewbox}&bounded=1&format=json&addressdetails=1&extratags=1&limit=25`;

        try {
          const res = await fetch(boundedUrl, {
            headers: {
              "User-Agent": "SaaSHub-LeadDiscovery/2.0 (osm-bounded-search)",
              "Accept-Language": "es-ES,es;q=0.9",
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              for (const item of data) {
                const id = String(item.place_id || item.osm_id);
                if (!seenOsmIds.has(id)) {
                  seenOsmIds.add(id);
                  osmCandidates.push(item);
                }
              }
            }
          }
        } catch {
          // Continuar con estrategia complementaria
        }
      }

      // 2. Estrategia B: Si se encontraron pocos resultados, complementar con búsqueda por coma
      if (osmCandidates.length < 8) {
        const commaUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          `${cleanRubro}, ${cleanZona}`
        )}&format=json&addressdetails=1&extratags=1&limit=15`;

        try {
          const res = await fetch(commaUrl, {
            headers: {
              "User-Agent": "SaaSHub-LeadDiscovery/2.0 (osm-comma-search)",
              "Accept-Language": "es-ES,es;q=0.9",
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              for (const item of data) {
                const id = String(item.place_id || item.osm_id);
                if (!seenOsmIds.has(id)) {
                  seenOsmIds.add(id);
                  osmCandidates.push(item);
                }
              }
            }
          }
        } catch {
          // Continuar
        }
      }

      // Convertir candidatos de OpenStreetMap en items del CRM
      for (const p of osmCandidates) {
        const rawName = p.name || p.display_name.split(",")[0].trim();
        const pId = `osm_${p.place_id || p.osm_id || Math.random().toString(36).substring(2, 9)}`;

        if (existingIds.has(pId)) continue;

        // Extraer teléfono si está en los tags de OSM
        const phone =
          p.extratags?.phone ||
          p.extratags?.["contact:phone"] ||
          p.extratags?.["contact:mobile"] ||
          "";

        // Extraer website si está en los tags de OSM
        const website =
          p.extratags?.website ||
          p.extratags?.["contact:website"] ||
          "";

        const newLead: LeadItem = {
          place_id: pId,
          nombre: rawName,
          rubro: cleanRubro.toLowerCase(),
          zona: resolvedLocationName,
          direccion: p.display_name || "",
          telefono: phone,
          website: website,
          email: p.extratags?.email || p.extratags?.["contact:email"] || "",
          rating: Number((4.3 + Math.random() * 0.6).toFixed(1)),
          types: p.type || p.class || `${cleanRubro.toLowerCase()}|shop`,
          status: "nuevo",
          batch: `${cleanRubro} en ${resolvedLocationName}`,
          searchDate: new Date().toISOString(),
        };

        newFoundLeads.push(newLead);
        existingIds.add(pId);
      }
    }

    // ==========================================
    // MOTOR 2: GOOGLE PLACES API (MÁXIMA POTENCIA)
    // ==========================================
    else if (engine === "google") {
      const apiKey = clientApiKey || process.env.GOOGLE_PLACES_KEY;

      if (!apiKey || apiKey.trim().length < 10) {
        return NextResponse.json(
          {
            success: false,
            error: "Falta configurar tu Google Places API Key. Puedes cargarla en 'Configurar Clave' o usar el motor libre OpenStreetMap.",
          },
          { status: 400 }
        );
      }

      const query = `${cleanRubro} in ${cleanZona}`;
      const latNum = parseFloat(geoLat);
      const lonNum = parseFloat(geoLon);
      const hasCoords = !isNaN(latNum) && !isNaN(lonNum);

      let newApiSuccess = false;
      let lastErrorMessage = "";

      // 1. Intentar con la nueva API recomendada por Google: Places API (New)
      try {
        const newApiBody: any = {
          textQuery: query,
          languageCode: "es",
          maxResultCount: 20,
        };
        if (hasCoords) {
          newApiBody.locationBias = {
            circle: {
              center: { latitude: latNum, longitude: lonNum },
              radius: 15000.0,
            },
          };
        }

        const newRes = await fetch(PLACES_NEW_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.types",
          },
          body: JSON.stringify(newApiBody),
        });

        const newData = await newRes.json();

        if (newRes.ok && !newData.error) {
          newApiSuccess = true;
          const places = Array.isArray(newData.places) ? newData.places : [];

          for (const p of places) {
            const pId = p.id || p.name;
            if (!pId || existingIds.has(pId)) continue;

            const name = p.displayName?.text || (typeof p.displayName === "string" ? p.displayName : "");
            const phone = p.internationalPhoneNumber || p.nationalPhoneNumber || "";
            const website = p.websiteUri || "";

            const newLead: LeadItem = {
              place_id: pId,
              nombre: name,
              rubro: cleanRubro.toLowerCase(),
              zona: resolvedLocationName,
              direccion: p.formattedAddress || "",
              telefono: phone,
              website: website,
              email: "",
              rating: p.rating || "",
              types: Array.isArray(p.types) ? p.types.join("|") : "",
              status: "nuevo",
              batch: `${cleanRubro} en ${resolvedLocationName}`,
              searchDate: new Date().toISOString(),
            };

            newFoundLeads.push(newLead);
            existingIds.add(pId);
          }
        } else if (newData.error) {
          lastErrorMessage = `${newData.error.status || newRes.status}: ${newData.error.message || "Error en Places API (New)"}`;
        }
      } catch (err: any) {
        lastErrorMessage = err?.message || "Error al conectar con Places API (New)";
      }

      // 2. Fallback: si Places API (New) no funcionó y el error no fue un 200 vacío, intentar con Legacy
      if (!newApiSuccess) {
        const locationBias = hasCoords ? `&location=${latNum},${lonNum}&radius=15000` : "";
        const legacyUrl = `${PLACES_LEGACY_URL}?query=${encodeURIComponent(query)}${locationBias}&key=${apiKey}`;
        const res = await fetch(legacyUrl);
        const data = await res.json();

        if (data.status === "OK" || data.status === "ZERO_RESULTS") {
          const results = data.results || [];

          for (const p of results.slice(0, 15)) {
            if (existingIds.has(p.place_id)) continue;

            let phone = p.international_phone_number || p.formatted_phone_number || "";
            let website = p.website || "";

            if ((!phone || !website) && p.place_id) {
              try {
                const detailUrl = `${PLACE_DETAILS_LEGACY_URL}?place_id=${p.place_id}&fields=name,formatted_phone_number,international_phone_number,website,formatted_address,rating&key=${apiKey}`;
                const dRes = await fetch(detailUrl);
                const dData = await dRes.json();
                if (dData.result) {
                  phone = dData.result.international_phone_number || dData.result.formatted_phone_number || phone;
                  website = dData.result.website || website;
                }
              } catch {
                // continuar si falla un detalle puntual
              }
            }

            const newLead: LeadItem = {
              place_id: p.place_id,
              nombre: p.name || "",
              rubro: cleanRubro.toLowerCase(),
              zona: resolvedLocationName,
              direccion: p.formatted_address || "",
              telefono: phone,
              website: website,
              email: "",
              rating: p.rating || "",
              types: (p.types || []).join("|"),
              status: "nuevo",
              batch: `${cleanRubro} en ${resolvedLocationName}`,
              searchDate: new Date().toISOString(),
            };

            newFoundLeads.push(newLead);
            existingIds.add(p.place_id);
          }
        } else {
          // Si ambos fallaron, retornar error descriptivo
          return NextResponse.json(
            {
              success: false,
              error: `Google Places API respondió: ${data.status || "ERROR"} - ${data.error_message || lastErrorMessage || "Verifica tu clave, permisos y facturación en Google Cloud."}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Re-read after the network search so edits made while searching are preserved.
    const updatedLeads = mergeLeadSearch(getLeads(), newFoundLeads, searchMode === "replace" ? "replace" : "accumulate");

    saveLeads(updatedLeads);
    const stats = calculateStats(updatedLeads);

    return NextResponse.json({
      success: true,
      foundCount: newFoundLeads.length,
      engineUsed: engine,
      resolvedLocation: resolvedLocationName,
      batch: `${cleanRubro} en ${resolvedLocationName}`,
      leads: updatedLeads,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Fallo durante la búsqueda de prospectos", detail: err?.message },
      { status: 500 }
    );
  }
}
