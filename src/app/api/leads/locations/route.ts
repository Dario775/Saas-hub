import { LocationItem,searchPredefinedLocations } from "@/lib/location-data";
import { NextRequest,NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    // 1. Obtener coincidencias inmediatas del catálogo local precargado
    const localMatches = searchPredefinedLocations(query, 8);

    // Si la consulta es corta o ya tenemos suficientes resultados curados, devolverlos
    if (query.length < 3 || localMatches.length >= 5) {
      return NextResponse.json({
        success: true,
        locations: localMatches,
        source: "local",
      });
    }

    // 2. Si el usuario escribe una localidad específica no incluida en el catálogo básico,
    // consultar Nominatim en tiempo real acotado a Argentina
    const combinedResults: LocationItem[] = [...localMatches];
    const seenNames = new Set(localMatches.map((l) => l.name.toLowerCase()));

    try {
      const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&countrycodes=ar&format=json&addressdetails=1&limit=6`;

      const res = await fetch(osmUrl, {
        headers: {
          "User-Agent": "SaaSHub-LeadDiscovery/2.0 (location-autocomplete)",
          "Accept-Language": "es-ES,es;q=0.9",
        },
      });

      if (res.ok) {
        const osmData = await res.json();
        if (Array.isArray(osmData)) {
          for (const item of osmData) {
            const addr = item.address || {};
            const cityName =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.municipality ||
              addr.suburb ||
              addr.county ||
              item.name ||
              item.display_name.split(",")[0].trim();

            const provincia = addr.state || addr.province || "Argentina";
            const country = addr.country || "Argentina";

            if (seenNames.has(cityName.toLowerCase())) continue;
            seenNames.add(cityName.toLowerCase());

            const display = `${cityName}, ${provincia}`;
            const itemType: LocationItem["type"] =
              addr.suburb || addr.neighbourhood
                ? "barrio"
                : addr.county
                ? "partido"
                : "ciudad";

            const locItem: LocationItem = {
              id: `osm-${item.place_id || Math.random().toString(36).substring(2, 8)}`,
              name: cityName,
              provincia,
              pais: country,
              display,
              type: itemType,
              lat: item.lat,
              lon: item.lon,
              boundingbox: item.boundingbox || [
                String(Number(item.lat) - 0.05),
                String(Number(item.lat) + 0.05),
                String(Number(item.lon) - 0.05),
                String(Number(item.lon) + 0.05),
              ],
            };

            combinedResults.push(locItem);
            if (combinedResults.length >= 8) break;
          }
        }
      }
    } catch {
      // Fallback a los resultados locales si Nominatim está inaccesible
    }

    return NextResponse.json({
      success: true,
      locations: combinedResults,
      source: "hybrid",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error al buscar ubicaciones" },
      { status: 500 }
    );
  }
}
