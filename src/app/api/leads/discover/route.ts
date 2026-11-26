import { NextRequest, NextResponse } from "next/server";
import { COMMERCIAL_CATEGORIES, resolveCategory } from "@/lib/commercial-taxonomy";
import { discoverLeads, importCandidates } from "@/lib/lead-discovery";
import type { LeadCandidate } from "@/lib/lead-discovery";
import { ALLOWED_RADIUS_KM } from "@/lib/overpass";

export const dynamic = "force-dynamic";

/**
 * Lead Discovery Engine (API).
 *
 * `GET`  → categorías comerciales disponibles.
 * `POST { action: "preview" }` → busca y clasifica candidatos. NO persiste nada.
 * `POST { action: "import" }`  → importa los candidatos elegidos explícitamente.
 *
 * Solo fuentes gratuitas (OpenStreetMap/Overpass + Nominatim). No contacta a
 * nadie y no importa nada sin una acción humana explícita.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    categories: COMMERCIAL_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      aliases: category.aliases,
      why: category.why,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "preview";
    const location = typeof body.location === "string" ? body.location.trim() : "";
    const category = resolveCategory(typeof body.category === "string" ? body.category : "");

    if (action === "import") {
      const candidates = Array.isArray(body.candidates) ? (body.candidates as LeadCandidate[]) : [];
      if (!candidates.length) {
        return NextResponse.json(
          { success: false, error: "No hay candidatos seleccionados para importar." },
          { status: 400 },
        );
      }
      const result = importCandidates(candidates, typeof body.areaName === "string" ? body.areaName : "");
      const { getLeads } = await import("@/lib/leads-service");
      return NextResponse.json({
        success: true,
        imported: result.imported,
        skipped: result.skipped,
        totalLeads: getLeads().length,
      });
    }

    if (!location) {
      return NextResponse.json(
        { success: false, error: "Falta la ubicación." },
        { status: 400 },
      );
    }
    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: "Categoría no soportada. Mirá el listado de categorías disponibles.",
          categories: COMMERCIAL_CATEGORIES.map((item) => item.label),
        },
        { status: 400 },
      );
    }

    const radiusKm = body.radiusKm;
    if (
      radiusKm !== undefined &&
      (typeof radiusKm !== "number" || !ALLOWED_RADIUS_KM.includes(radiusKm))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Radio no permitido. Elegí uno de estos, en km: " + ALLOWED_RADIUS_KM.join(", ") + ".",
        },
        { status: 400 },
      );
    }

    const max = typeof body.max === "number" ? body.max : 20;
    const result = await discoverLeads({
      location,
      category,
      max,
      radiusKm,
    });

    return NextResponse.json({
      success: true,
      areaName: result.areaName,
      category: { id: result.categoryId, label: result.categoryLabel },
      boundingBox: result.boundingBox,
      candidates: result.candidates,
      metrics: result.metrics,
      errors: result.errors,
      geocode: result.geocode,
      overpass: result.overpass,
      note: "Vista previa: no se importó nada. La importación requiere acción humana.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Error en el descubrimiento de prospectos",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
