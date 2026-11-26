import type { LogoVariants } from "./images";
import type { TemplateContext } from "./template";
import { buildTheme } from "./theme";
import { FLYER_SIZES, type FlyerBrand, type FlyerConcept, type FlyerFormat } from "./types";

/** El sitio como se lee en un flyer: sin protocolo, sin www y sin barra final. */
export function displayWebsite(website: string): string {
  return website.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

/** Datos que necesita un diseño para dibujarse, en imagen o en video. */
export function flyerContext(
  concept: FlyerConcept,
  format: FlyerFormat,
  brand: FlyerBrand,
  logo: LogoVariants | null,
  assetUrl: string | null,
): TemplateContext {
  const theme = buildTheme(brand, concept.tone);
  const { width, height } = FLYER_SIZES[format];
  return {
    slots: concept.slots,
    theme,
    width,
    height,
    brandName: brand.name,
    website: displayWebsite(brand.website),
    logoUrl: logo ? (theme.dark ? logo.light : logo.dark) : null,
    logoLightUrl: logo?.light || null,
    logoDarkUrl: logo?.dark || null,
    assetUrl,
  };
}
