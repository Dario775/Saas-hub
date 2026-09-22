import { calculateStats,getLeads,LeadStatus,updateLeadStatus } from "@/lib/leads-service";
import { NextRequest,NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { placeId, status, notes, customPitch } = body;

    if (!placeId || !status) {
      return NextResponse.json(
        { success: false, error: "Parámetros incompletos (placeId y status requeridos)" },
        { status: 400 }
      );
    }

    const updated = updateLeadStatus(placeId, status as LeadStatus, notes, customPitch);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Prospecto no encontrado" },
        { status: 404 }
      );
    }

    const leads = getLeads();
    const stats = calculateStats(leads);

    return NextResponse.json({
      success: true,
      lead: updated,
      leads,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Error al actualizar estado del prospecto", detail: err?.message },
      { status: 500 }
    );
  }
}
