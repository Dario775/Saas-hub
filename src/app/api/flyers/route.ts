import { loadFlyerBrand } from "@/lib/flyers/brand";
import { logPublished, readSource } from "@/lib/flyers/publications";
import { updateJob } from "@/lib/flyers/store";
import { readDB } from "@/lib/scheduler";
import { animateFlyer, readVideoSeconds } from "@/lib/flyers/motion";
import { readStyleChoice } from "@/lib/motion/styles";
import { exportFlyer, reviseFlyer, startFlyerJob, visibleJobs } from "@/lib/flyers/pipeline";
import { FLYER_SIZES, type FlyerFormat } from "@/lib/flyers/types";
import { NextRequest, NextResponse } from "next/server";

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

const loadBrand = loadFlyerBrand;

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
    return NextResponse.json({ success: true, jobs: visibleJobs(brandId, readDB()).slice(0, 20) });
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
    if (body.action === "published") {
      // Publicado al instante desde el panel: se anota en el flyer para mostrarlo en su tarjeta.
      const source = readSource({ jobId: body.jobId, flyerId: body.flyerId, media: body.media });
      if (!source) throw new Error("Falta indicar qué flyer se publicó.");
      const permalink = typeof body.permalink === "string" && /^https:\/\/(www\.)?facebook\.com\//.test(body.permalink) ? body.permalink : undefined;
      await updateJob(source.jobId, (job) => ({
        ...job,
        flyers: job.flyers.map((flyer) =>
          flyer.id === source.flyerId
            ? logPublished(flyer, { media: source.media, pageId: String(body.pageId || brand.id).slice(0, 80), at: new Date().toISOString(), ...(permalink ? { permalink } : {}) })
            : flyer,
        ),
      }));
      return NextResponse.json({ success: true });
    }
    if (body.action === "animate") {
      const { job } = await animateFlyer({
        jobId: String(body.jobId || ""),
        flyerId: String(body.flyerId || ""),
        brand,
        seconds: readVideoSeconds(body.seconds),
        music: body.music !== false,
        style: readStyleChoice(body.style),
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
