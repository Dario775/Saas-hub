import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/leads-service";
import {
  analyzeOpportunity,
  isAnalysisInFlight,
  resolveSellerContext,
} from "@/lib/opportunity-pipeline";

export const dynamic = "force-dynamic";

/**
 * Analiza la oportunidad comercial de UN prospecto.
 *
 * Solo lectura de datos públicos y llamadas a los motores configurados:
 * no contacta a nadie, no publica nada y no borra información.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";

    if (!placeId) {
      return NextResponse.json(
        { success: false, error: "Falta el identificador del prospecto (placeId)." },
        { status: 400 },
      );
    }

    const lead = getLeads().find((item) => item.place_id === placeId);
    if (!lead) {
      return NextResponse.json(
        { success: false, error: "Prospecto no encontrado." },
        { status: 404 },
      );
    }

    const alreadyRunning = isAnalysisInFlight(placeId);
    const result = await analyzeOpportunity(lead, {
      skipEnrichment: body.skipEnrichment === true,
      skipJev: body.skipJev === true,
      skipAnalysis: body.skipAnalysis === true,
      // Vuelve a consultar las fuentes en lugar de usar el dossier guardado.
      forceRefresh: body.forceRefresh === true,
      seller: resolveSellerContext(),
    });

    const updated = getLeads().find((item) => item.place_id === placeId) || lead;

    return NextResponse.json({
      success: result.ok,
      alreadyRunning,
      result,
      lead: updated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Error al analizar la oportunidad",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
