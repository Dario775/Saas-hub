import { calculateStats,getLeads,saveLeads } from "@/lib/leads-service";
import { fetchPublic } from "@/lib/public-fetch";
import { NextRequest,NextResponse } from "next/server";

const RE_MAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BASURA = ["png", "jpg", "jpeg", "gif", "webp", "svg", "example", "sentry", "wixpress", "godaddy", "domain.com", ".png", "@2x", "sentry.io", "email.com", "your@", "name@", "mail@mail"];

async function fetchText(url: string): Promise<string> {
  try {
    const result = await fetchPublic(url, 300_000);
    return result.body.toString("utf8");
  } catch {
    return "";
  }
}

function cleanEmails(emails: string[]): string[] {
  const vistos = new Set<string>();
  for (const e of emails) {
    const m = e.trim().toLowerCase();
    if (!m || m.length > 80) continue;
    if (BASURA.some((b) => m.includes(b))) continue;
    if (!m.includes(".")) continue;
    vistos.add(m);
  }
  return [...vistos];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(50, Math.max(1, Number(body.limit) || 15));

    const leads = getLeads();
    const candidates = leads.filter((l) => l.website && !l.email).slice(0, limit);

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay prospectos con sitio web pendientes de escanear email.",
        scannedCount: 0,
        foundCount: 0,
        leads,
        stats: calculateStats(leads),
      });
    }

    let foundCount = 0;
    const extraRoutes = ["", "/contacto", "/contact"];

    for (const lead of candidates) {
      let baseUrl = lead.website!.trim();
      if (!baseUrl.startsWith("http")) baseUrl = "https://" + baseUrl;
      baseUrl = baseUrl.replace(/\/+$/, "");

      const detectedEmails: string[] = [];

      for (const route of extraRoutes) {
        try {
          const html = await fetchText(`${baseUrl}${route}`);
          if (html) {
            const matches = html.match(RE_MAIL);
            if (matches) detectedEmails.push(...matches);
          }
          if (detectedEmails.length > 0) break;
        } catch {
          // continuar
        }
      }

      const cleaned = cleanEmails(detectedEmails);
      if (cleaned.length > 0) {
        lead.email = cleaned[0];
        foundCount++;
      }
    }

    const latest = getLeads();
    for (const lead of latest) { const scanned = leads.find(item => item.place_id === lead.place_id); if (scanned?.email) lead.email = scanned.email; }
    saveLeads(latest);
    const stats = calculateStats(leads);

    return NextResponse.json({
      success: true,
      scannedCount: candidates.length,
      foundCount,
      leads,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Error durante el escaneo de emails", detail: err?.message },
      { status: 500 }
    );
  }
}
