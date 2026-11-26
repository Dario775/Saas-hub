import type { ImageGenerator } from "./generators";
import { hexToColorName } from "./generators";
import type { LLMSettings } from "./llm";
import { queryLLM } from "./llm";

export interface ConceptStrategy {
  id: string;
  name: string;
  description: string;
}

// Las 5 estrategias del plan: Corporativo premium, Tecnológico, Minimalista,
// Ecommerce agresivo, Startup internacional
export const CONCEPT_STRATEGIES: ConceptStrategy[] = [
  { id: "corporativo-premium", name: "Corporativo Premium", description: "Sobrio, de alto nivel, confiable, serio" },
  { id: "tecnologico", name: "Tecnológico", description: "Futurista, gadgets, luces, innovación" },
  { id: "minimalista", name: "Minimalista", description: "Poco texto, mucho espacio, elegante" },
  { id: "ecommerce-agresivo", name: "Ecommerce Agresivo", description: "Ofertas, CTAs fuertes, urgencia, venta directa" },
  { id: "startup-internacional", name: "Startup Internacional", description: "Estilo Silicon Valley, limpio, moderno, anglosajón" },
];

export interface Concept {
  strategyId: string;
  conceptName: string;
  headline: string;
  subtitle: string;
  cta: string;
  visualPrompt: string; // descripción visual rica de la escena/imagen
  negativePrompt: string;
  caption: string; // copy largo para la red social
  modelHint: "escena" | "fotorealista" | "texto";
}

export interface CreativeDirectorInput {
  topic: string;
  platform: string; // instagram, facebook, flyer, story
  aspectRatio: string; // 1:1, 9:16, 4:5...
  language?: "es" | "en";
  brand?: {
    name: string;
    projectDescription?: string;
    targetAudience?: string;
    valueProposition?: string;
    voiceTone?: string;
    brandGuidelines?: string;
    colors?: { primary: string[]; secondary: string[] };
    styleAspects?: string;
    typography?: { heading?: string; body?: string };
  };
  strategyIds: string[];
}

// Modelo al que rutea cada hint (cada modelo hace lo que mejor sabe)
export const ROUTER: Record<Concept["modelHint"], ImageGenerator> = {
  escena: "z-image-turbo",
  fotorealista: "flux-2-klein",
  texto: "qwen-image-2.1", // el único local que escribió bien el español en las pruebas
};

export const ROUTER_REASON: Record<Concept["modelHint"], string> = {
  escena: "Z-Image-Turbo — composición publicitaria con espacio para el texto",
  fotorealista: "FLUX 2 Klein — realismo fotográfico de personas y productos",
  texto: "Qwen Image 2.1 — texto en español integrado en la imagen",
};

export function buildDirectorSystemPrompt(input: CreativeDirectorInput): string {
  const brand = input.brand;
  const strategies = input.strategyIds
    .map((id) => CONCEPT_STRATEGIES.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => `- "${s!.id}": ${s!.description}`)
    .join("\n");

  const primaryNames = brand?.colors?.primary?.map(hexToColorName).filter(Boolean).join(", ") || brand?.colors?.primary?.join(", ") || "libre";
  const secondaryNames = brand?.colors?.secondary?.map(hexToColorName).filter(Boolean).join(", ") || brand?.colors?.secondary?.join(", ") || "libre";

  const brandContext = brand?.name
    ? `
=== DIRECTRICES ESTRICTAS E INQUEBRANTABLES DE LA MARCA ===
ESTÁS DISEÑANDO EXCLUSIVAMENTE PARA LA MARCA: "${brand.name}"
- Descripción del Negocio / Producto: ${brand.projectDescription || "Empresa profesional y moderna."}
- Público Objetivo: ${brand.targetAudience || "Público general y clientes potenciales."}
- Propuesta de Valor Principal: ${brand.valueProposition || "Calidad y soluciones innovadoras."}
- Tono de Voz / Personalidad: ${brand.voiceTone || "Profesional, cercano y persuasivo"}
- Directrices Visuales: ${brand.brandGuidelines || brand.styleAspects || "Estilo pulcro y publicitario"}
- Paleta de Colores Corporativos: Primarios (${primaryNames}) | Secundarios (${secondaryNames})
- Tipografía Sugerida: ${brand.typography?.heading || "Moderna"}
OBLIGATORIO: Debes alinear cada concepto, copy, titular y prompt visual a la personalidad y propuesta de valor de "${brand.name}".
============================================================`
    : "";

  const isEnglish = input.language === "en";
  const languageRules = isEnglish
    ? `IDIOMA DEL COPY: Redacta 'conceptName', 'headline', 'subtitle', 'cta' y 'caption' OBLIGATORIAMENTE EN INGLÉS.`
    : `IDIOMA DEL COPY: Redacta 'conceptName', 'headline', 'subtitle', 'cta' y 'caption' OBLIGATORIAMENTE EN ESPAÑOL (castellano natural, persuasivo y comercial).`;

  return `Eres el Director Creativo Estratégico de una prestigiosa agencia publicitaria.
Tu rol es generar conceptos publicitarios completos y ejecutables: cada concepto incluye copy publicitario Y un prompt visual cinematográfico de alta calidad que un modelo de difusión local pueda renderizar.

${brandContext}

=== TAREA ===
Diseña una pieza publicitaria para la plataforma "${input.platform}" 
para el tema: "${input.topic}".
Aspect ratio: ${input.aspectRatio}.

Genera UN concepto por cada una de estas estrategias. Cada estrategia debe tener una dirección visual y de copy TOTALMENTE distinta:
${strategies}

=== REGLAS DE IDIOMA Y COPY ===
${languageRules}
- **headline**: titular publicitario corto e impactante (MÁXIMO 2 a 4 palabras, ej: ${isEnglish ? '"ELEVATE YOUR SALES"' : '"AUTOMATIZA TU NEGOCIO"'}). Los titulares cortos garantizan que el generador renderice letras 100% nítidas y sin deformaciones.
- **subtitle**: línea secundaria explicativa corta (MÁXIMO 6 palabras).
- **cta**: llamado a la acción persuasivo (MÁXIMO 3 palabras, ej: ${isEnglish ? '"Get Started"' : '"Empieza hoy"'}).
- **caption**: copy completo para la red social (${input.platform}) con emojis atractivos, saltos de línea y 3 a 5 hashtags relevantes de la marca.

=== REGLAS PARA EL PROMPT VISUAL (CRÍTICO) ===
- El campo "visualPrompt" DEBE ESTAR ESCRITO EN INGLÉS (los modelos de difusión como Z-Image-Turbo y FLUX requieren inglés para generar imágenes fotorrealistas).
- Describe una escena fotográfica cinematográfica real: sujeto principal concreto (personas auténticas, acciones naturales, entorno de alta gama).
- Composición con espacio negativo limpio para texto publicitario.
- Iluminación cinematográfica de estudio (softbox, rim light, 35mm lens, 8k resolution).
- Integra sutilmente la paleta de colores de la marca (${primaryNames}).
- El titular se agrega después en el editor: NO pidas letras, textos ni logos dentro de la imagen, salvo que uses modelHint "texto".
- **modelHint**: "fotorealista" si el protagonista es una persona o un producto; "texto" SOLO si las letras forman parte de la escena (neón, cartel, globos); "escena" en los demás casos.
- NUNCA uses palabras como "flyer", "brochure", "mockup", "poster" ni "UI" en el prompt visual. Describe el sujeto físico y real.

=== REGLAS DE SALIDA ===
Responde ÚNICAMENTE con un objeto JSON válido con la clave "concepts":
{
  "concepts": [
    {
      "strategyId": "id de la estrategia (corporativo-premium | tecnologico | minimalista | ecommerce-agresivo | startup-internacional)",
      "conceptName": "${isEnglish ? 'Creative name in English' : 'Nombre creativo en Español'}",
      "headline": "${isEnglish ? 'SHORT HEADLINE' : 'TITULAR CORTO EN ESPAÑOL'}",
      "subtitle": "${isEnglish ? 'Short subtitle' : 'Subtítulo corto en español'}",
      "cta": "${isEnglish ? 'Action CTA' : 'CTA en español'}",
      "visualPrompt": "detailed cinematic commercial photography prompt in ENGLISH with clean negative space, 35mm lens, studio lighting",
      "negativePrompt": "watermark, blurry, low quality, distorted text, deformed letters, malformed typography, warped font, bad anatomy",
      "caption": "${isEnglish ? 'Engaging social media post copy in English with emojis and hashtags' : 'Copy publicitario completo en español con emojis y hashtags'}",
      "modelHint": "escena | fotorealista | texto"
    }
  ]
}`;
}

// Adapta el prompt visual al modelo que va a renderizar (cada modelo habla su idioma)
export function adaptPromptForModel(concept: Concept, generatorId: ImageGenerator): string {
  const base = concept.visualPrompt.trim();

  // El titular lo pone el editor: pedirlo acá lo deforma.
  const cleanSpace = "clean empty copy space for a headline, no text, no letters, no logos";

  if (generatorId === "qwen-image-2.1") {
    return concept.headline
      ? `${base}, featuring the text "${concept.headline.trim().replace(/"/g, "'")}" integrated in the scene, clearly legible`
      : base;
  }

  if (generatorId === "z-image-turbo" || generatorId === "flux-2-klein") {
    return `${base}, ${cleanSpace}, professional commercial photography, natural skin texture, sharp focus, shot on 35mm lens`;
  }

  if (generatorId === "flux-schnell" || generatorId === "flux-dev") {
    return `${base}, ${cleanSpace}, cinematic photography, dramatic studio lighting, premium composition, sharp focus`;
  }

  if (generatorId === "realvis-xl") {
    return `${base}, professional product photography, shot on 85mm lens, f/2.8, soft studio lighting, shallow depth of field, natural skin texture, ultra realistic texture details, 8k high detail`;
  }

  // ideogram-4 y otros: se usa tal cual (Ideogram recibe su prompt estructurado aparte)
  return base;
}

// Genera los N conceptos con el LLM
export async function generateConcepts(
  input: CreativeDirectorInput,
  llmSettings?: LLMSettings
): Promise<Concept[]> {
  const systemPrompt = buildDirectorSystemPrompt(input);
  const userPrompt = `Genera los 5 conceptos para la plataforma "${input.platform}" y el tema "${input.topic}" (aspect ratio ${input.aspectRatio}). Responde en JSON con la clave 'concepts'.`;

  const parseConcepts = (raw: string): Concept[] => {
    if (!raw || !raw.trim()) return [];
    let clean = raw.trim();
    clean = clean.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (e2) {
          console.error("[CreativeStudio] Error parseando JSON de conceptos:", clean.substring(0, 300));
          return [];
        }
      } else {
        return [];
      }
    }

    if (Array.isArray(parsed)) return parsed as Concept[];
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, any>;
      if (Array.isArray(obj.concepts)) return obj.concepts as Concept[];
      const values = Object.values(obj).filter(
        (v: any) => v && typeof v === "object" && (v.visualPrompt || v.conceptName || v.headline)
      );
      if (values.length > 0) return values as Concept[];
      if (typeof obj.visualPrompt === "string" || typeof obj.conceptName === "string") {
        return [obj as unknown as Concept];
      }
    }
    return [];
  };

  let lastError: string | null = null;
  let result = "";

  // Intento 1: JSON estricto
  try {
    result = await queryLLM(systemPrompt, userPrompt, llmSettings, true);
  } catch (e: any) {
    lastError = e?.message || String(e);
    console.warn("[CreativeStudio] Primer intento falló:", lastError);
  }

  let concepts = parseConcepts(result);

  // Si el intento estricto no dio un array con varios conceptos, reintentar sin forzar JSON
  if (concepts.length < 2) {
    try {
      console.warn("[CreativeStudio] Reintentando generación de conceptos...");
      result = await queryLLM(systemPrompt, userPrompt, llmSettings, false);
      const fallback = parseConcepts(result);
      if (fallback.length > concepts.length) concepts = fallback;
    } catch (e: any) {
      lastError = e?.message || String(e);
      console.warn("[CreativeStudio] Segundo intento también falló:", lastError);
    }
  }

  if (!Array.isArray(concepts) || concepts.length === 0) {
    throw new Error(lastError || "El LLM no devolvió conceptos estructurados válidos");
  }

  // Normalizar modelHint: aceptar palabras exactas o frases con la palabra clave
  function normalizeHint(raw: string): Concept["modelHint"] {
    const v = (raw || "").toLowerCase();
    if (v.includes("fotoreal") || v.includes("realist") || v.includes("producto") || v.includes("foto")) {
      return "fotorealista";
    }
    if (v.includes("texto") || v.includes("text ") || v.includes("tipograf") || v.includes("flyer")) {
      return "texto";
    }
    return "escena";
  }

  // Sanitizar: garantizar campos y modelHint válido
  return concepts.map((c) => ({
    strategyId: c.strategyId || "escena",
    conceptName: c.conceptName || "Concepto",
    headline: c.headline || "",
    subtitle: c.subtitle || "",
    cta: c.cta || "",
    visualPrompt: c.visualPrompt || input.topic,
    negativePrompt: c.negativePrompt
      ? c.negativePrompt.replace(/\btext\b/gi, "distorted text").trim()
      : "watermark, logo, blurry, low quality, distorted text, deformed letters, malformed typography, warped font",
    caption: c.caption || "",
    modelHint: normalizeHint(c.modelHint),
  }));
}