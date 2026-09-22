import { hexToColorName } from "@/lib/generators";
import { queryLLM } from "@/lib/llm";
import { NextRequest,NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quickIdea, llmSettings, brandName, voiceTone, brandGuidelines, targetAudience, valueProposition, colors, projectDescription } = body;

    if (!quickIdea) {
      return NextResponse.json({ error: "Falta la idea rápida" }, { status: 400 });
    }

    const primaryNames = colors?.primary?.map(hexToColorName).filter(Boolean).join(', ') || 'Libre';
    const secondaryNames = colors?.secondary?.map(hexToColorName).filter(Boolean).join(', ') || 'Libre';

    const brandContext = brandName ? `
=== CONTEXTO OBLIGATORIO DE LA MARCA ===
ESTÁS DISEÑANDO EXCLUSIVAMENTE PARA LA MARCA: "${brandName}"
Descripción del Negocio/Proyecto: ${projectDescription || 'No especificada. Asume un contexto corporativo estándar.'}
Público Objetivo: ${targetAudience || 'Público general.'}
Propuesta de Valor Principal: ${valueProposition || 'No especificada.'}
Tono de voz/Personalidad: ${voiceTone || 'Profesional'}
Reglas y Directrices Visuales (ESTRICTAS E INQUEBRANTABLES): ${brandGuidelines || 'Ninguna regla adicional'}
Colores Primarios: ${primaryNames}
Colores Secundarios: ${secondaryNames}
========================================
` : '';

    const systemPrompt = `Eres un Director de Arte y Fotografía Publicitaria de clase mundial para generadores de imágenes (Z-Image-Turbo, FLUX, Ideogram).
Tu tarea es traducir la idea del usuario en un concepto publicitario de altísimo impacto visual.
${brandContext}

REGLAS CRÍTICAS DE REDACCIÓN:
1. **imageSubject**: DEBE ESTAR ESCRITO EN INGLÉS. Describe una escena fotográfica cinematográfica del mundo real (personas auténticas, acciones naturales, entorno de alta gama). DEBES incluir composición con **espacio negativo limpio** (ej: "with clean empty negative space on the left side"). NUNCA uses palabras como "flyer", "folleto", "poster", "brochure", "mockup", "interface" o "UI", ya que arruinan la imagen. Describe el sujeto físico y real.
2. **imageDetails**: DEBE ESTAR ESCRITO EN INGLÉS. Iluminación cinematográfica de estudio, atmósfera, lentes y paleta de colores de la marca (ej: "soft studio lighting, 35mm lens photography, shallow depth of field, ambient slate and cobalt blue color grading").
3. **imageText**: El titular principal en el idioma del usuario. CRÍTICO: MÁXIMO 1 A 3 PALABRAS EN MAYÚSCULAS (ej: "AUTOMATIZA HOY", "CRECE RÁPIDO", "OFERTA EXCLUSIVA"). Las palabras cortas permiten que el modelo dibuje caracteres perfectos sin deformaciones.
4. **imageNegative**: "watermark, blurry, low quality, distorted text, deformed letters, malformed typography, warped font, fused letters, broken characters, ugly, misspelled words, deformed hands, extra fingers, bad anatomy, paper brochure artifacts, messy collage, low resolution".
5. **imageStyle**: "realista" o "cinematografico" (o el adecuado a la marca).
6. **imageSubtitle**: Subtítulo secundario ultra corto (MÁXIMO 3 PALABRAS) para copy o diseño.
7. **imageBullets**: 2 a 3 viñetas cortas.

Debes responder ÚNICAMENTE con un JSON válido:
{
  "imageSubject": "cinematic commercial photograph of a confident Latin businesswoman working in a modern minimalist studio, soft natural backlight, clean empty negative copy space on the side",
  "imageText": "TITULAR_CORTO",
  "imageStyle": "realista",
  "imageDetails": "professional commercial lighting, subtle brand color accents, 35mm lens, 8k resolution",
  "imageNegative": "watermark, blurry, low quality, distorted text, deformed letters, malformed typography, warped font, fused letters, bad anatomy, paper brochure artifacts, low resolution",
  "aspectRatio": "1:1",
  "dailyVariation": "ninguno",
  "imageSubtitle": "subtítulo corto",
  "imageSubtitleStyle": "clean-white",
  "imageBullets": "Rápido, Seguro, Escalable"
}`;

    const userPrompt = `Idea rápida del usuario: "${quickIdea}"`;

    console.log("Expandiendo idea rápida mediante el LLM...");
    const llmResponse = await queryLLM(systemPrompt, userPrompt, llmSettings, true);
    console.log("Idea expandida con éxito:", llmResponse);

    let parsedData;
    const cleanResponse = llmResponse.trim();
    try {
      parsedData = JSON.parse(cleanResponse);
    } catch (e) {
      console.warn("Fallo el parseo inicial del JSON. Intentando extraer por regex...", cleanResponse);
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          console.error("Fallo definitivo al parsear JSON del LLM:", cleanResponse);
          return NextResponse.json({ error: "El LLM no retornó un formato JSON válido", raw: cleanResponse }, { status: 500 });
        }
      } else {
        console.error("No se encontró estructura JSON en la respuesta:", cleanResponse);
        return NextResponse.json({ error: "No se encontró un bloque JSON en la respuesta del LLM", raw: cleanResponse }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      data: parsedData
    });
  } catch (err: any) {
    const isRateLimit = err.message?.includes("429");
    const status = isRateLimit ? 429 : 500;
    const errorMsg = isRateLimit 
      ? "Límite de solicitudes de Gemini excedido (Error 429)" 
      : "Error al expandir la idea con IA";
    return NextResponse.json(
      { error: errorMsg, detail: err.message },
      { status }
    );
  }
}
