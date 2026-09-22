export interface LocationItem {
  id: string;
  name: string;
  provincia: string;
  pais: string;
  display: string;
  type: "ciudad" | "barrio" | "partido" | "provincia";
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [minLat, maxLat, minLon, maxLon]
}

// Catálogo curado de las principales localidades y zonas comerciales de Argentina
export const PREDEFINED_LOCATIONS: LocationItem[] = [
  // CABA (Ciudad Autónoma de Buenos Aires)
  {
    id: "caba-palermo",
    name: "Palermo",
    provincia: "Ciudad Autónoma de Buenos Aires",
    pais: "Argentina",
    display: "Palermo, CABA",
    type: "barrio",
    lat: "-34.5733",
    lon: "-58.4233",
    boundingbox: ["-34.5978556", "-34.5509349", "-58.4490952", "-58.3928657"],
  },
  {
    id: "caba-belgrano",
    name: "Belgrano",
    provincia: "Ciudad Autónoma de Buenos Aires",
    display: "Belgrano, CABA",
    pais: "Argentina",
    type: "barrio",
    lat: "-34.5614",
    lon: "-58.4566",
    boundingbox: ["-34.5750000", "-34.5450000", "-58.4750000", "-58.4350000"],
  },
  {
    id: "caba-caballito",
    name: "Caballito",
    provincia: "Ciudad Autónoma de Buenos Aires",
    display: "Caballito, CABA",
    pais: "Argentina",
    type: "barrio",
    lat: "-34.6198",
    lon: "-58.4441",
    boundingbox: ["-34.6350000", "-34.6050000", "-58.4600000", "-58.4250000"],
  },
  {
    id: "caba-recoleta",
    name: "Recoleta",
    provincia: "Ciudad Autónoma de Buenos Aires",
    display: "Recoleta, CABA",
    pais: "Argentina",
    type: "barrio",
    lat: "-34.5888",
    lon: "-58.3960",
    boundingbox: ["-34.6050000", "-34.5750000", "-58.4100000", "-58.3800000"],
  },
  {
    id: "caba-almagro",
    name: "Almagro",
    provincia: "Ciudad Autónoma de Buenos Aires",
    display: "Almagro, CABA",
    pais: "Argentina",
    type: "barrio",
    lat: "-34.6105",
    lon: "-58.4222",
    boundingbox: ["-34.6200000", "-34.6000000", "-58.4350000", "-58.4100000"],
  },
  {
    id: "caba-villa-urquiza",
    name: "Villa Urquiza",
    provincia: "Ciudad Autónoma de Buenos Aires",
    display: "Villa Urquiza, CABA",
    pais: "Argentina",
    type: "barrio",
    lat: "-34.5739",
    lon: "-58.4903",
    boundingbox: ["-34.5850000", "-34.5600000", "-58.5050000", "-58.4750000"],
  },
  {
    id: "caba-centro",
    name: "Centro / San Nicolás",
    provincia: "Ciudad Autónoma de Buenos Aires",
    display: "Centro / San Nicolás, CABA",
    pais: "Argentina",
    type: "barrio",
    lat: "-34.6037",
    lon: "-58.3816",
    boundingbox: ["-34.6150000", "-34.5950000", "-58.3950000", "-58.3700000"],
  },

  // Gran Buenos Aires Norte
  {
    id: "gba-vicente-lopez",
    name: "Vicente López",
    provincia: "Buenos Aires",
    display: "Vicente López, Buenos Aires",
    pais: "Argentina",
    type: "partido",
    lat: "-34.5292",
    lon: "-58.4795",
    boundingbox: ["-34.5550000", "-34.5100000", "-58.5200000", "-58.4600000"],
  },
  {
    id: "gba-san-isidro",
    name: "San Isidro",
    provincia: "Buenos Aires",
    display: "San Isidro, Buenos Aires",
    pais: "Argentina",
    type: "partido",
    lat: "-34.4717",
    lon: "-58.5278",
    boundingbox: ["-34.4989542", "-34.4486603", "-58.5643747", "-58.4957709"],
  },
  {
    id: "gba-olivos",
    name: "Olivos",
    provincia: "Buenos Aires",
    display: "Olivos, Vicente López, Buenos Aires",
    pais: "Argentina",
    type: "ciudad",
    lat: "-34.5103",
    lon: "-58.4947",
    boundingbox: ["-34.5250000", "-34.4950000", "-58.5150000", "-58.4750000"],
  },
  {
    id: "gba-martinez",
    name: "Martínez",
    provincia: "Buenos Aires",
    display: "Martínez, San Isidro, Buenos Aires",
    pais: "Argentina",
    type: "ciudad",
    lat: "-34.4939",
    lon: "-58.5086",
    boundingbox: ["-34.5100000", "-34.4800000", "-58.5300000", "-58.4900000"],
  },
  {
    id: "gba-tigre",
    name: "Tigre",
    provincia: "Buenos Aires",
    display: "Tigre, Buenos Aires",
    pais: "Argentina",
    type: "partido",
    lat: "-34.4260",
    lon: "-58.5796",
    boundingbox: ["-34.4600000", "-34.3800000", "-58.6200000", "-58.5400000"],
  },
  {
    id: "gba-pilar",
    name: "Pilar",
    provincia: "Buenos Aires",
    display: "Pilar, Buenos Aires",
    pais: "Argentina",
    type: "partido",
    lat: "-34.4587",
    lon: "-58.9142",
    boundingbox: ["-34.5200000", "-34.4000000", "-59.0000000", "-58.8500000"],
  },

  // Gran Buenos Aires Oeste y Sur
  {
    id: "gba-moron",
    name: "Morón",
    provincia: "Buenos Aires",
    display: "Morón, Buenos Aires",
    pais: "Argentina",
    type: "partido",
    lat: "-34.6534",
    lon: "-58.6198",
    boundingbox: ["-34.6850000", "-34.6300000", "-58.6550000", "-58.5800000"],
  },
  {
    id: "gba-ramos-mejia",
    name: "Ramos Mejía",
    provincia: "Buenos Aires",
    display: "Ramos Mejía, La Matanza, Buenos Aires",
    pais: "Argentina",
    type: "ciudad",
    lat: "-34.6433",
    lon: "-58.5645",
    boundingbox: ["-34.6600000", "-34.6300000", "-58.5800000", "-58.5450000"],
  },
  {
    id: "gba-castelar",
    name: "Castelar",
    provincia: "Buenos Aires",
    display: "Castelar, Morón, Buenos Aires",
    pais: "Argentina",
    type: "ciudad",
    lat: "-34.6542",
    lon: "-58.6369",
    boundingbox: ["-34.6700000", "-34.6400000", "-58.6550000", "-58.6200000"],
  },
  {
    id: "gba-quilmes",
    name: "Quilmes",
    provincia: "Buenos Aires",
    display: "Quilmes, Buenos Aires",
    pais: "Argentina",
    type: "partido",
    lat: "-34.7245",
    lon: "-58.2520",
    boundingbox: ["-34.7600000", "-34.6900000", "-58.3100000", "-58.2100000"],
  },
  {
    id: "gba-lomas-de-zamora",
    name: "Lomas de Zamora",
    provincia: "Buenos Aires",
    display: "Lomas de Zamora, Buenos Aires",
    pais: "Argentina",
    type: "partido",
    lat: "-34.7600",
    lon: "-58.4000",
    boundingbox: ["-34.8000000", "-34.7200000", "-58.4500000", "-58.3500000"],
  },
  {
    id: "gba-avellaneda",
    name: "Avellaneda",
    provincia: "Buenos Aires",
    display: "Avellaneda, Buenos Aires",
    pais: "Argentina",
    type: "partido",
    lat: "-34.6611",
    lon: "-58.3647",
    boundingbox: ["-34.7000000", "-34.6400000", "-58.4000000", "-58.3300000"],
  },

  // Provincia de Buenos Aires (Interior)
  {
    id: "pba-la-plata",
    name: "La Plata",
    provincia: "Buenos Aires",
    display: "La Plata, Buenos Aires",
    pais: "Argentina",
    type: "ciudad",
    lat: "-34.9214",
    lon: "-57.9545",
    boundingbox: ["-34.9800000", "-34.8800000", "-58.0300000", "-57.8800000"],
  },
  {
    id: "pba-mar-del-plata",
    name: "Mar del Plata",
    provincia: "Buenos Aires",
    display: "Mar del Plata, Buenos Aires",
    pais: "Argentina",
    type: "ciudad",
    lat: "-38.0055",
    lon: "-57.5560",
    boundingbox: ["-38.1271439", "-37.9039649", "-57.6591066", "-57.5177864"],
  },
  {
    id: "pba-bahia-blanca",
    name: "Bahía Blanca",
    provincia: "Buenos Aires",
    display: "Bahía Blanca, Buenos Aires",
    pais: "Argentina",
    type: "ciudad",
    lat: "-38.7183",
    lon: "-62.2663",
    boundingbox: ["-38.7800000", "-38.6500000", "-62.3500000", "-62.2000000"],
  },
  {
    id: "pba-tandil",
    name: "Tandil",
    provincia: "Buenos Aires",
    display: "Tandil, Buenos Aires",
    pais: "Argentina",
    type: "ciudad",
    lat: "-37.3217",
    lon: "-59.1332",
    boundingbox: ["-37.3600000", "-37.2800000", "-59.1800000", "-59.0800000"],
  },
  {
    id: "pba-san-nicolas",
    name: "San Nicolás de los Arroyos",
    provincia: "Buenos Aires",
    display: "San Nicolás, Buenos Aires",
    pais: "Argentina",
    type: "ciudad",
    lat: "-33.3333",
    lon: "-60.2167",
    boundingbox: ["-33.3700000", "-33.3000000", "-60.2600000", "-60.1800000"],
  },

  // Córdoba
  {
    id: "cba-cordoba-capital",
    name: "Córdoba Capital",
    provincia: "Córdoba",
    display: "Córdoba Capital, Córdoba",
    pais: "Argentina",
    type: "ciudad",
    lat: "-31.4201",
    lon: "-64.1888",
    boundingbox: ["-31.5251273", "-31.3083295", "-64.3100957", "-64.0572500"],
  },
  {
    id: "cba-villa-carlos-paz",
    name: "Villa Carlos Paz",
    provincia: "Córdoba",
    display: "Villa Carlos Paz, Córdoba",
    pais: "Argentina",
    type: "ciudad",
    lat: "-31.4241",
    lon: "-64.4978",
    boundingbox: ["-31.4600000", "-31.3800000", "-64.5300000", "-64.4600000"],
  },
  {
    id: "cba-rio-cuarto",
    name: "Río Cuarto",
    provincia: "Córdoba",
    display: "Río Cuarto, Córdoba",
    pais: "Argentina",
    type: "ciudad",
    lat: "-33.1307",
    lon: "-64.3499",
    boundingbox: ["-33.1800000", "-33.0900000", "-64.4000000", "-64.3000000"],
  },
  {
    id: "cba-villa-maria",
    name: "Villa María",
    provincia: "Córdoba",
    display: "Villa María, Córdoba",
    pais: "Argentina",
    type: "ciudad",
    lat: "-32.4075",
    lon: "-63.2402",
    boundingbox: ["-32.4400000", "-32.3800000", "-63.2800000", "-63.2000000"],
  },

  // Santa Fe
  {
    id: "sfe-rosario",
    name: "Rosario",
    provincia: "Santa Fe",
    display: "Rosario, Santa Fe",
    pais: "Argentina",
    type: "ciudad",
    lat: "-32.9587",
    lon: "-60.6930",
    boundingbox: ["-33.0348662", "-32.8696461", "-60.7832623", "-60.6116695"],
  },
  {
    id: "sfe-santa-fe-capital",
    name: "Santa Fe Capital",
    provincia: "Santa Fe",
    display: "Santa Fe Capital, Santa Fe",
    pais: "Argentina",
    type: "ciudad",
    lat: "-31.6333",
    lon: "-60.7000",
    boundingbox: ["-31.6800000", "-31.5800000", "-60.7500000", "-60.6500000"],
  },
  {
    id: "sfe-rafaela",
    name: "Rafaela",
    provincia: "Santa Fe",
    display: "Rafaela, Santa Fe",
    pais: "Argentina",
    type: "ciudad",
    lat: "-31.2503",
    lon: "-61.4867",
    boundingbox: ["-31.2800000", "-31.2200000", "-61.5200000", "-61.4500000"],
  },
  {
    id: "sfe-venado-tuerto",
    name: "Venado Tuerto",
    provincia: "Santa Fe",
    display: "Venado Tuerto, Santa Fe",
    pais: "Argentina",
    type: "ciudad",
    lat: "-33.7456",
    lon: "-61.9688",
    boundingbox: ["-33.7800000", "-33.7100000", "-62.0000000", "-61.9300000"],
  },

  // Mendoza
  {
    id: "mdz-mendoza-capital",
    name: "Mendoza Capital",
    provincia: "Mendoza",
    display: "Mendoza Capital, Mendoza",
    pais: "Argentina",
    type: "ciudad",
    lat: "-32.8908",
    lon: "-68.8272",
    boundingbox: ["-32.9200000", "-32.8600000", "-68.8600000", "-68.8000000"],
  },
  {
    id: "mdz-godoy-cruz",
    name: "Godoy Cruz",
    provincia: "Mendoza",
    display: "Godoy Cruz, Mendoza",
    pais: "Argentina",
    type: "ciudad",
    lat: "-32.9306",
    lon: "-68.8353",
    boundingbox: ["-32.9604954", "-32.8993149", "-69.0172353", "-68.8038438"],
  },
  {
    id: "mdz-guaymallen",
    name: "Guaymallén",
    provincia: "Mendoza",
    display: "Guaymallén, Mendoza",
    pais: "Argentina",
    type: "ciudad",
    lat: "-32.8986",
    lon: "-68.7905",
    boundingbox: ["-32.9500000", "-32.8500000", "-68.8200000", "-68.7000000"],
  },
  {
    id: "mdz-las-heras",
    name: "Las Heras",
    provincia: "Mendoza",
    display: "Las Heras, Mendoza",
    pais: "Argentina",
    type: "ciudad",
    lat: "-32.8500",
    lon: "-68.8200",
    boundingbox: ["-32.8800000", "-32.8200000", "-68.8600000", "-68.7800000"],
  },
  {
    id: "mdz-san-rafael",
    name: "San Rafael",
    provincia: "Mendoza",
    display: "San Rafael, Mendoza",
    pais: "Argentina",
    type: "ciudad",
    lat: "-34.6177",
    lon: "-68.3301",
    boundingbox: ["-34.6728808", "-34.5897974", "-68.3970319", "-68.2796831"],
  },
  {
    id: "mdz-lujan-de-cuyo",
    name: "Luján de Cuyo",
    provincia: "Mendoza",
    display: "Luján de Cuyo, Mendoza",
    pais: "Argentina",
    type: "ciudad",
    lat: "-33.0353",
    lon: "-68.8778",
    boundingbox: ["-33.1000000", "-32.9800000", "-68.9500000", "-68.8200000"],
  },

  // Tucumán
  {
    id: "tuc-san-miguel",
    name: "San Miguel de Tucumán",
    provincia: "Tucumán",
    display: "San Miguel de Tucumán, Tucumán",
    pais: "Argentina",
    type: "ciudad",
    lat: "-26.8241",
    lon: "-65.2226",
    boundingbox: ["-26.8600000", "-26.7800000", "-65.2600000", "-65.1800000"],
  },
  {
    id: "tuc-yerba-buena",
    name: "Yerba Buena",
    provincia: "Tucumán",
    display: "Yerba Buena, Tucumán",
    pais: "Argentina",
    type: "ciudad",
    lat: "-26.8167",
    lon: "-65.3167",
    boundingbox: ["-26.8500000", "-26.7900000", "-65.3500000", "-65.2800000"],
  },

  // Salta y Jujuy
  {
    id: "sla-salta-capital",
    name: "Salta Capital",
    provincia: "Salta",
    display: "Salta Capital, Salta",
    pais: "Argentina",
    type: "ciudad",
    lat: "-24.7859",
    lon: "-65.4117",
    boundingbox: ["-24.8400000", "-24.7400000", "-65.4600000", "-65.3600000"],
  },
  {
    id: "juj-san-salvador",
    name: "San Salvador de Jujuy",
    provincia: "Jujuy",
    display: "San Salvador de Jujuy, Jujuy",
    pais: "Argentina",
    type: "ciudad",
    lat: "-24.1858",
    lon: "-65.2995",
    boundingbox: ["-24.2200000", "-24.1500000", "-65.3400000", "-65.2600000"],
  },

  // Entre Ríos
  {
    id: "ers-parana",
    name: "Paraná",
    provincia: "Entre Ríos",
    display: "Paraná, Entre Ríos",
    pais: "Argentina",
    type: "ciudad",
    lat: "-31.7333",
    lon: "-60.5333",
    boundingbox: ["-31.7800000", "-31.6900000", "-60.5800000", "-60.4800000"],
  },
  {
    id: "ers-concordia",
    name: "Concordia",
    provincia: "Entre Ríos",
    display: "Concordia, Entre Ríos",
    pais: "Argentina",
    type: "ciudad",
    lat: "-31.3930",
    lon: "-58.0209",
    boundingbox: ["-31.4400000", "-31.3500000", "-58.0700000", "-57.9700000"],
  },

  // Patagonia
  {
    id: "nqn-neuquen-capital",
    name: "Neuquén Capital",
    provincia: "Neuquén",
    display: "Neuquén Capital, Neuquén",
    pais: "Argentina",
    type: "ciudad",
    lat: "-38.9516",
    lon: "-68.0591",
    boundingbox: ["-39.0000000", "-38.9000000", "-68.1200000", "-68.0000000"],
  },
  {
    id: "rno-bariloche",
    name: "San Carlos de Bariloche",
    provincia: "Río Negro",
    display: "San Carlos de Bariloche, Río Negro",
    pais: "Argentina",
    type: "ciudad",
    lat: "-41.1335",
    lon: "-71.3103",
    boundingbox: ["-41.1900000", "-41.0800000", "-71.3900000", "-71.2500000"],
  },

  // Cuyo & Centro
  {
    id: "sjn-san-juan-capital",
    name: "San Juan Capital",
    provincia: "San Juan",
    display: "San Juan Capital, San Juan",
    pais: "Argentina",
    type: "ciudad",
    lat: "-31.5375",
    lon: "-68.5364",
    boundingbox: ["-31.5800000", "-31.5000000", "-68.5800000", "-68.4800000"],
  },
  {
    id: "sls-san-luis-capital",
    name: "San Luis Capital",
    provincia: "San Luis",
    display: "San Luis Capital, San Luis",
    pais: "Argentina",
    type: "ciudad",
    lat: "-33.2950",
    lon: "-66.3356",
    boundingbox: ["-33.3400000", "-33.2500000", "-66.3800000", "-66.2900000"],
  },
  {
    id: "cha-resistencia",
    name: "Resistencia",
    provincia: "Chaco",
    display: "Resistencia, Chaco",
    pais: "Argentina",
    type: "ciudad",
    lat: "-27.4514",
    lon: "-58.9866",
    boundingbox: ["-27.5000000", "-27.4000000", "-59.0300000", "-58.9400000"],
  },
  {
    id: "cor-corrientes-capital",
    name: "Corrientes Capital",
    provincia: "Corrientes",
    display: "Corrientes Capital, Corrientes",
    pais: "Argentina",
    type: "ciudad",
    lat: "-27.4806",
    lon: "-58.8341",
    boundingbox: ["-27.5300000", "-27.4300000", "-58.8800000", "-58.7800000"],
  },
];

// Función para normalizar texto (quitar tildes, minúsculas)
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Búsqueda en memoria de alta velocidad
export function searchPredefinedLocations(query: string, limit = 8): LocationItem[] {
  if (!query || !query.trim()) {
    return PREDEFINED_LOCATIONS.slice(0, limit);
  }

  const cleanQ = normalizeText(query);
  const parts = cleanQ.split(/[\s,]+/).filter(Boolean);

  const scored = PREDEFINED_LOCATIONS.map((loc) => {
    const nameNorm = normalizeText(loc.name);
    const provNorm = normalizeText(loc.provincia);
    const dispNorm = normalizeText(loc.display);

    let score = 0;
    // Coincidencia exacta de inicio
    if (nameNorm.startsWith(cleanQ)) score += 50;
    if (dispNorm.startsWith(cleanQ)) score += 40;

    // Coincidencia de cada término
    for (const part of parts) {
      if (nameNorm.includes(part)) score += 20;
      if (provNorm.includes(part)) score += 15;
      if (dispNorm.includes(part)) score += 10;
    }

    return { loc, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.loc);
}
