import type { BrandConfig } from "@/features/workspace/config";
import { animateFlyer, readVideoSeconds } from "@/lib/flyers/motion";
import { exportFlyer, reviseFlyer, startFlyerJob, visibleJobs } from "@/lib/flyers/pipeline";
import { FLYER_SIZES, type FlyerBrand, type FlyerFormat } from "@/lib/flyers/types";
import { readJson } from "@/lib/json-store";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BRIEF = 2_000;
const MAX_INSTRUCTION = 600;
const MODEL = /^[\w.:/-]{2,80}$/;

function fail(error: unknown, status = 400) {
  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : "No se pudo completar la operación." },
    { status },
  );
}

function loadBrand(id: unknown): FlyerBrand {
  const brands = readJson<BrandConfig[]>(path.join(process.cwd(), "brands.json"), []);
  const brand = brands.find((item) => item.id === id);
  if (!brand) throw new Error("Completá y guardá la identidad de esta marca antes de crear flyers.");
  return {
    id: brand.id,
    name: brand.name,
    website: brand.websiteUrl || "",
    description: brand.projectDescription || "",
    audience: brand.targetAudience || "",
    valueProposition: brand.valueProposition || "",
    voice: brand.voiceTone || "",
    primary: brand.colors.primary[0] || "",
    accent: brand.colors.secondary?.[0] || brand.colors.primary[1] || brand.colors.primary[0] || "",
    headingFont: brand.typography?.heading || "",
    logoDataUrl: brand.logoDataUrl,
  };
}

function readText(value: unknown, max: number, missing: string): string {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean) throw new Error(missing);
  if (clean.length > max) throw new Error(`El texto supera los ${max} caracteres.`);
  return clean;
}

function readModel(value: unknown): string {
  if (typeof value === "string" && MODEL.test(value)) return value;
  throw new Error("Elegí un modelo válido.");
}

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brand") || undefined;
    return NextResponse.json({ success: true, jobs: visibleJobs(brandId).slice(0, 20) });
  } catch (error) {
    return fail(error, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const brand = loadBrand(body.brandId);
    if (body.action === "export") {
      const design = await exportFlyer(String(body.jobId || ""), String(body.flyerId || ""), brand);
      return NextResponse.json({ success: true, design });
    }
    if (body.action === "animate") {
      const { job } = await animateFlyer({
        jobId: String(body.jobId || ""),
        flyerId: String(body.flyerId || ""),
        brand,
        seconds: readVideoSeconds(body.seconds),
        music: body.music !== false,
      });
      return NextResponse.json({ success: true, job }, { status: 202 });
    }
    const model = readModel(body.model);
    if (body.action === "revise") {
      const job = await reviseFlyer(
        String(body.jobId || ""),
        String(body.flyerId || ""),
        readText(body.instruction, MAX_INSTRUCTION, "Escribí qué querés cambiar."),
        brand,
        model,
      );
      return NextResponse.json({ success: true, job });
    }
    const format = body.format as FlyerFormat;
    if (!(format in FLYER_SIZES)) throw new Error("Formato no disponible.");
    const { job } = await startFlyerJob({
      brand,
      model,
      format,
      brief: readText(body.brief, MAX_BRIEF, "Contá qué querés comunicar."),
    });
    return NextResponse.json({ success: true, job }, { status: 202 });
  } catch (error) {
    return fail(error);
  }
}
