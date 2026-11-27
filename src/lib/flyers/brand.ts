import type { BrandConfig } from "@/features/workspace/config";
import path from "node:path";
import { readJson } from "../json-store";
import type { FlyerBrand } from "./types";

export function readBrands(): BrandConfig[] {
  const brands = readJson<BrandConfig[]>(path.join(process.cwd(), "brands.json"), []);
  return Array.isArray(brands) ? brands : [];
}

/** Identidad de la marca tal como la usan los flyers. */
export function loadFlyerBrand(id: unknown): FlyerBrand {
  const brand = readBrands().find((item) => item.id === id);
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
