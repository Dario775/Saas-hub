import { queryLLM } from "@/lib/llm";
import { NextRequest,NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageSubject, imageDetails, imageText, brandName, voiceTone, brandGuidelines, projectDescription, targetAudience, valueProposition, llmSettings } = body;

    const systemPrompt = `Eres un experto Community Manager y redactor publicitario para redes sociales (Copywriter).
Tu tarea es redactar el texto (caption) de una publicación para la marca "${brandName}".

Descripción del Negocio/Proyecto: ${projectDescription || 'No especificada.'}
Público Objetivo: ${targetAudience || 'Público general.'}
Propuesta de Valor Principal: ${valueProposition || 'No especificada.'}
Tono de Voz de la marca: ${voiceTone || 'Profesional, amigable y directo.'}
Reglas y Directrices ESTRICTAS de la marca: ${brandGuidelines || 'Ninguna regla adicional.'}

Contexto de la imagen que acompañará este texto:
- Tema principal: ${imageSubject}
- Detalles de la imagen: ${imageDetails}
- Texto que aparece en la imagen: ${imageText}

Instrucciones:
1. Redacta un texto persuasivo, atractivo y listo para publicar en Facebook o Instagram.
2. Utiliza el tono de voz especificado.
3. DEBES CUMPLIR OBLIGATORIAMENTE todas las "Reglas y Directrices ESTRICTAS" de la marca mencionadas arriba (ej: incluir ciertas palabras, emojis específicos, o frases obligatorias).
4. Incluye emojis apropiados (pero sin abusar, a menos que las directrices digan lo contrario).
5. Agrega un llamado a la acción (Call to Action) claro al final.
6. Usa hashtags relevantes al final del post.
7. NO escribas introducciones como "Aquí tienes el texto:" ni uses comillas alrededor del texto. Escribe SOLO el contenido del post listo para copiar y pegar.
`;

    const userPrompt = `Por favor, redacta el post basándote en la imagen descrita.`;

    console.log("Generando caption con IA...");
    const llmResponse = await queryLLM(systemPrompt, userPrompt, llmSettings, false);
    
    return NextResponse.json({
      success: true,
      caption: llmResponse.trim()
    });
  } catch (err: any) {
    console.error("Error generando caption:", err);
    const isRateLimit = err.message?.includes("429");
    const status = isRateLimit ? 429 : 500;
    const errorMsg = isRateLimit 
      ? "Límite de solicitudes de Gemini excedido (Error 429)" 
      : "Error al generar el texto con IA";
    return NextResponse.json(
      { error: errorMsg, detail: err.message },
      { status }
    );
  }
}
