import { buildWhatsAppLink,getCampaignConfig,LeadItem,updateLeadStatus } from "@/lib/leads-service";
import { queryLLM } from "@/lib/llm";
import { NextRequest,NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const campaign = getCampaignConfig();

    // Los valores de la campaña activa son la base; el request puede sobreescribirlos puntualmente.
    const {
      lead,
      brandName = campaign.brandName || "Tu Marca",
      valueProposition = campaign.valueProposition || "",
      voiceTone = campaign.voiceTone || "profesional y cercano",
    } = body;

    if (!lead || !lead.nombre) {
      return NextResponse.json(
        { success: false, error: "Datos de prospecto incompletos" },
        { status: 400 }
      );
    }

    const systemPrompt = `Eres un experto en prospección B2B y ventas consultivas por WhatsApp y mensajes directos.
Tu objetivo es redactar un mensaje inicial de prospección hiper-personalizado, breve, magnético y sin rodeos.
Reglas:
1. Longitud máxima: 2-3 párrafos cortos (menos de 65 palabras en total).
2. Tono: ${voiceTone}.
3. Debe mencionar el nombre del negocio ("${lead.nombre}"), su rubro ("${lead.rubro}") y su ubicación o zona ("${lead.zona || 'su localidad'}").
4. Proponer un gancho claro sobre cómo ${brandName} ${valueProposition ? `(${valueProposition})` : 'ayuda a digitalizar, facturar y multiplicar sus clientes'} sin complicaciones.
5. Llamado a la acción (CTA) directo: pedir 5 minutos para una demo rápida sin compromiso.
6. Devuelve únicamente el texto del mensaje, sin comillas ni encabezados adicionales.
7. No inventes datos que no figuren en la ficha del negocio (puntuaciones, reseñas, horarios, cantidad de clientes): si un dato no está, omítelo.`;

    const userPrompt = `Negocio: ${lead.nombre}
Rubro: ${lead.rubro}
Zona: ${lead.zona}
Web: ${lead.website || "No tiene"}
${lead.rating ? `Puntuación pública informada por la fuente de datos: ${lead.rating}\n` : ""}
Redacta el mensaje de prospección:`;

    let generatedPitch = "";
    try {
      generatedPitch = await queryLLM(systemPrompt, userPrompt, undefined, false);
      generatedPitch = generatedPitch.trim().replace(/^["']|["']$/g, "");
    } catch (llmErr) {
      // Fallback si no hay conexión a LLM en este instante
      generatedPitch = `Hola 👋 Vi ${lead.nombre} (${lead.rubro}) en ${lead.zona} y quería mostrarle algo que le va a servir: ${brandName}${valueProposition ? ` (${valueProposition})` : ""}, para vender más y automatizar sus operaciones sin complicaciones. ¿Tiene 5 minutos para una demo rápida sin compromiso?`;
    }

    // Actualizar el customPitch del lead si tiene place_id
    if (lead.place_id) {
      updateLeadStatus(lead.place_id, lead.status || "nuevo", undefined, generatedPitch);
    }

    const updatedLead: LeadItem = {
      ...lead,
      customPitch: generatedPitch,
      whatsappLink: buildWhatsAppLink({ ...lead, customPitch: generatedPitch }, brandName),
    };

    return NextResponse.json({
      success: true,
      pitch: generatedPitch,
      whatsappLink: updatedLead.whatsappLink,
      campaign: { brandName, valueProposition, voiceTone },
      lead: updatedLead,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Error al generar pitch de ventas", detail: err?.message },
      { status: 500 }
    );
  }
}
