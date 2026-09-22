import type { BrandConfig } from "@/features/workspace/config";
import { readJson,withFileLock,writeJson } from "@/lib/json-store";
import { NextRequest,NextResponse } from "next/server";
import path from "node:path";
const file = path.join(process.cwd(), "brands.json");
function validBrand(brand: BrandConfig) {
  if (
    !brand ||
    typeof brand.id !== "string" ||
    !brand.id.trim() ||
    typeof brand.name !== "string" ||
    !brand.name.trim() ||
    !Array.isArray(brand.colors?.primary) ||
    !brand.typography?.heading
  )
    throw new Error(
      "Completá el nombre, los colores y la tipografía de la marca.",
    );
  if (JSON.stringify(brand).length > 3_000_000)
    throw new Error(
      "La identidad supera el límite de 3 MB. Usá un logo más liviano.",
    );
}
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      brands: readJson<BrandConfig[]>(file, []),
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer la identidad guardada." },
      { status: 500 },
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const brands = await withFileLock(file, async () => {
      const current = readJson<BrandConfig[]>(file, []);
      if (body.migrate) {
        if (current.length) return current;
        if (!Array.isArray(body.brands) || body.brands.length > 50)
          throw new Error("Lista de marcas inválida.");
        body.brands.forEach(validBrand);
        writeJson(file, body.brands);
        return body.brands;
      }
      validBrand(body.brand);
      const index = current.findIndex((brand) => brand.id === body.brand.id);
      if (index < 0) current.push(body.brand);
      else current[index] = body.brand;
      writeJson(file, current);
      return current;
    });
    return NextResponse.json({ success: true, brands });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar." },
      { status: 400 },
    );
  }
}
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json(
      { error: "ID de marca no proporcionado." },
      { status: 400 },
    );
  try {
    const brands = await withFileLock(file, async () => {
      const current = readJson<BrandConfig[]>(file, []);
      if (current.length <= 1) {
        throw new Error("No podés eliminar la única marca activa del sistema.");
      }
      const next = current.filter((brand) => brand.id !== id);
      writeJson(file, next);
      return next;
    });
    return NextResponse.json({ success: true, brands });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la marca." },
      { status: 400 },
    );
  }
}
