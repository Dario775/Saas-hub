/**
 * Taxonomía comercial: traduce una intención de negocio (en castellano) a
 * etiquetas de OpenStreetMap. Deliberadamente chica y extensible.
 *
 * Solo contiene categorías donde nuestros productos (sitio, ecommerce,
 * catálogo, automatización, marketing, software, POS) suelen tener sentido.
 * No inventa etiquetas: cada entrada usa tags reales de OSM.
 */

export interface CommercialCategory {
  /** Identificador estable, en minúsculas y sin acentos. */
  id: string;
  /** Nombre legible para la interfaz. */
  label: string;
  /** Variantes aceptadas al escribir (incluye el propio label normalizado). */
  aliases: string[];
  /** Etiquetas OSM que representan la categoría: clave + valor. */
  tags: { key: string; value: string }[];
  /** Por qué nos interesa comercialmente (orientativo, no una decisión). */
  why: string;
}

export const COMMERCIAL_CATEGORIES: CommercialCategory[] = [
  {
    id: "ferreteria",
    label: "Ferretería",
    aliases: ["ferreteria", "ferreterias", "hardware", "bulonera"],
    tags: [
      { key: "shop", value: "hardware" },
      { key: "shop", value: "doityourself" },
    ],
    why: "Catálogo extenso y stock: buen caso para ecommerce, catálogo digital y POS.",
  },
  {
    id: "gimnasio",
    label: "Gimnasio",
    aliases: ["gimnasio", "gimnasios", "gym", "fitness"],
    tags: [
      { key: "leisure", value: "fitness_centre" },
      { key: "leisure", value: "sports_centre" },
    ],
    why: "Turnos, cuotas y socios: automatización, sitio y marketing.",
  },
  {
    id: "ropa",
    label: "Tienda de ropa",
    aliases: ["ropa", "indumentaria", "boutique", "moda"],
    tags: [
      { key: "shop", value: "clothes" },
      { key: "shop", value: "boutique" },
    ],
    why: "Venta visual: ecommerce, catálogo e Instagram.",
  },
  {
    id: "repuestos_automotor",
    label: "Repuestos automotor",
    aliases: ["repuestos", "autopartes", "repuestos automotor", "accesorios auto"],
    tags: [
      { key: "shop", value: "car_parts" },
      { key: "shop", value: "car_repair" },
    ],
    why: "Búsqueda por número de pieza: catálogo online y software a medida.",
  },
  {
    id: "panaderia",
    label: "Panadería",
    aliases: ["panaderia", "panificados", "confiteria"],
    tags: [
      { key: "shop", value: "bakery" },
      { key: "shop", value: "pastry" },
    ],
    why: "Pedidos por WhatsApp: automatización de pedidos y sitio simple.",
  },
  {
    id: "peluqueria",
    label: "Peluquería",
    aliases: ["peluqueria", "peluquerias", "barberia", "estetica"],
    tags: [
      { key: "shop", value: "hairdresser" },
      { key: "shop", value: "beauty" },
    ],
    why: "Turnos: automatización de reservas y marketing local.",
  },
  {
    id: "muebles",
    label: "Muebles",
    aliases: ["muebles", "muebleria", "amoblamientos"],
    tags: [
      { key: "shop", value: "furniture" },
      { key: "shop", value: "interior_decoration" },
    ],
    why: "Catálogo con medidas: catálogo digital y sitio.",
  },
  {
    id: "farmacia",
    label: "Farmacia",
    aliases: ["farmacia", "farmacias", "drogueria"],
    tags: [
      { key: "amenity", value: "pharmacy" },
      { key: "shop", value: "chemist" },
    ],
    why: "Horarios y pedidos: sitio, automatización y marketing.",
  },
  {
    id: "libreria",
    label: "Librería",
    aliases: ["libreria", "librerias", "papeleria"],
    tags: [
      { key: "shop", value: "books" },
      { key: "shop", value: "stationery" },
    ],
    why: "Stock y pedidos escolares: catálogo y ecommerce.",
  },
  {
    id: "electronica",
    label: "Electrónica",
    aliases: ["electronica", "tecnologia", "celulares", "informatica"],
    tags: [
      { key: "shop", value: "electronics" },
      { key: "shop", value: "mobile_phone" },
      { key: "shop", value: "computer" },
    ],
    why: "Fichas técnicas y garantías: catálogo, software y automatización.",
  },
];

/** Normaliza texto para comparar categorías escritas por una persona. */
export function normalizeCategoryText(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Resuelve la categoría a partir de lo que escribió el usuario. */
export function resolveCategory(input?: string | null): CommercialCategory | undefined {
  const wanted = normalizeCategoryText(input);
  if (!wanted) return undefined;
  return COMMERCIAL_CATEGORIES.find(
    (category) =>
      category.id === wanted ||
      normalizeCategoryText(category.label) === wanted ||
      category.aliases.some((alias) => normalizeCategoryText(alias) === wanted),
  );
}

/** Etiquetas OSM de una categoría, en el formato `clave=valor`. */
export function categoryTags(category: CommercialCategory): string[] {
  return category.tags.map((tag) => tag.key + "=" + tag.value);
}

/** Etiquetas OSM que identifican cualquier negocio de nuestras categorías. */
export function allOsmTags(): { key: string; value: string }[] {
  const seen = new Set<string>();
  const tags: { key: string; value: string }[] = [];
  for (const category of COMMERCIAL_CATEGORIES) {
    for (const tag of category.tags) {
      const id = tag.key + "=" + tag.value;
      if (seen.has(id)) continue;
      seen.add(id);
      tags.push(tag);
    }
  }
  return tags;
}
