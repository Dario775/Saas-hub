import { calculateStats,getLeads,saveLeads } from "@/lib/leads-service";
import { NextRequest,NextResponse } from "next/server";

export async function GET() {
  try {
    const leads = getLeads();

    const stats = calculateStats(leads);
    return NextResponse.json({ success: true, leads, stats });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Error al obtener leads", detail: err?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("placeId");
    const deleteAll = searchParams.get("all") === "true";
    const deleteOnlyNew = searchParams.get("onlyNew") === "true";
    const batch = searchParams.get("batch");

    const currentLeads = getLeads();

    // 1. Vaciar toda la lista
    if (deleteAll) {
      saveLeads([]);
      return NextResponse.json({ success: true, leads: [], stats: calculateStats([]) });
    }

    // 2. Limpiar únicamente prospectos no contactados (proteger los trabajados)
    if (deleteOnlyNew) {
      const preserved = currentLeads.filter(
        (l) => l.status !== "nuevo" || Boolean(l.notes || l.customPitch || l.lastContactedAt)
      );
      saveLeads(preserved);
      return NextResponse.json({ success: true, leads: preserved, stats: calculateStats(preserved) });
    }

    // 3. Borrar por lote de búsqueda
    if (batch) {
      const filtered = currentLeads.filter((l) => l.batch !== batch);
      saveLeads(filtered);
      return NextResponse.json({ success: true, leads: filtered, stats: calculateStats(filtered) });
    }

    // 4. Borrar un solo prospecto por placeId
    if (placeId) {
      const filtered = currentLeads.filter((l) => l.place_id !== placeId);
      saveLeads(filtered);
      return NextResponse.json({ success: true, leads: filtered, stats: calculateStats(filtered) });
    }

    return NextResponse.json(
      { success: false, error: "Debes especificar placeId, all=true, onlyNew=true o batch" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Error al eliminar leads", detail: err?.message },
      { status: 500 }
    );
  }
}
