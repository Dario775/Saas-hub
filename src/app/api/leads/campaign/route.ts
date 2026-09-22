import {
CampaignConfig,
DEFAULT_CAMPAIGN,
getCampaignConfig,
saveCampaignConfig,
} from "@/lib/leads-service";
import { NextRequest,NextResponse } from "next/server";

export async function GET() {
  const campaign = getCampaignConfig();
  return NextResponse.json({
    success: true,
    campaign,
    defaults: DEFAULT_CAMPAIGN,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // POST {reset:true} restaura los valores por defecto
    if (body && body.reset === true) {
      saveCampaignConfig({});
      return NextResponse.json({
        success: true,
        campaign: getCampaignConfig(),
        defaults: DEFAULT_CAMPAIGN,
      });
    }

    const current = getCampaignConfig();
    const next: CampaignConfig = { ...current };

    if (body && typeof body === "object") {
      if (typeof body.name === "string") next.name = body.name.trim();
      if (typeof body.brandName === "string") next.brandName = body.brandName.trim();
      if (typeof body.valueProposition === "string")
        next.valueProposition = body.valueProposition.trim();
      if (typeof body.voiceTone === "string") next.voiceTone = body.voiceTone.trim();
      if (typeof body.messageTemplate === "string")
        next.messageTemplate = body.messageTemplate.trim();
    }

    next.updatedAt = new Date().toISOString();
    saveCampaignConfig(next);

    return NextResponse.json({
      success: true,
      campaign: getCampaignConfig(),
      defaults: DEFAULT_CAMPAIGN,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Error al guardar la campaña", detail: err?.message },
      { status: 500 }
    );
  }
}
