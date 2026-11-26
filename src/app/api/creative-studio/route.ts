import { comfyGenerate, comfyHealth } from "@/lib/comfy-client";
import { adaptPromptForModel, CONCEPT_STRATEGIES, generateConcepts, ROUTER, ROUTER_REASON } from "@/lib/concept-studio";
import { buildRichPrompt, GENERATORS, IDEOGRAM_4_WORKFLOW, type ImageGenerator } from "@/lib/generators";
import { ideogramPrompt } from "@/lib/ideogram-prompt";
import { queryLLM } from "@/lib/llm";
import { renderSizeForAspect } from "@/lib/render-sizes";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      topic,
      platform = "instagram",
      aspectRatio = "1:1",
      language = "es",
      brand,
      strategyIds,
      llmSettings,
      upscale = "ultrasharp",
      renderAll = false,
      width,
      height,
    } = body;

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Falta el tema de la campaña" }, { status: 400 });
    }

    const strategies = Array.isArray(strategyIds) && strategyIds.length > 0
      ? strategyIds
      : CONCEPT_STRATEGIES.map((s) => s.id);

    // 1. El LLM genera los conceptos (director creativo de marketing)
    console.log(`[CreativeStudio] Generando 5 conceptos estratégicos con IA (Idioma: ${language})...`);
    const concepts = await generateConcepts(
      {
        topic: topic.trim(),
        platform,
        aspectRatio,
        language: (language as "es" | "en") || "es",
        brand,
        strategyIds: strategies,
      },
      llmSettings
    );

    // 2. Comprobar servicios disponibles (ComfyUI local y Gemini en la nube)
    const isComfyOnline = await comfyHealth();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || body.geminiApiKey);
    const hasOpenaiKey = Boolean(process.env.OPENAI_API_KEY || body.openaiApiKey);
    const baseSize = width && height
      ? { width: Number(width), height: Number(height) }
      : renderSizeForAspect(aspectRatio);

    // Modo rápido por defecto (entrega instantánea en 3-5s sin riesgo de timeouts)
    if (!renderAll || !isComfyOnline) {
      const enrichedConcepts = concepts.map((concept) => {
        const generatorId: ImageGenerator = ROUTER[concept.modelHint] || "z-image-turbo";
        const gen = GENERATORS[generatorId];
        return {
          ...concept,
          renderPrompt: adaptPromptForModel(concept, generatorId),
          aspectRatio,
          generator: generatorId,
          generatorName: gen.name,
          generatorReason: ROUTER_REASON[concept.modelHint],
          image: null,
          canRenderComfy: isComfyOnline,
          canRenderCloud: hasGeminiKey || hasOpenaiKey,
        };
      });

      return NextResponse.json({
        success: true,
        fastMode: true,
        comfyOnline: isComfyOnline,
        cloudAvailable: hasGeminiKey || hasOpenaiKey,
        platform,
        aspectRatio,
        concepts: enrichedConcepts,
      });
    }

    // Modo renderizado completo opcional
    const results = [];
    for (const concept of concepts) {
      const generatorId: ImageGenerator = ROUTER[concept.modelHint] || "flux-schnell";
      const gen = GENERATORS[generatorId];

      console.log(`[CreativeStudio] Renderizando concepto "${concept.conceptName}" -> ${generatorId}`);

      const params: Record<string, number | string> = {
        ...gen.defaultParams,
        ...baseSize,
        upscale,
      };

      let finalPrompt = adaptPromptForModel(concept, generatorId);

      if (generatorId === "ideogram-4") {
        const systemPromptTemplate = IDEOGRAM_4_WORKFLOW["134:114"]?.inputs?.value || "";
        const rawPrompt = buildRichPrompt(
          concept.visualPrompt,
          concept.headline,
          "ninguno",
          "",
          "ninguno",
          "ninguno",
          "modern-white",
          concept.subtitle,
          "clean-white",
          "",
          brand
            ? {
                name: brand.name,
                guidelines: brand.brandGuidelines,
                voiceTone: brand.voiceTone,
                colors: brand.colors,
                typography: brand.typography,
                projectDescription: brand.projectDescription,
                targetAudience: brand.targetAudience,
                valueProposition: brand.valueProposition,
                styleAspects: brand.styleAspects,
              }
            : undefined
        );
        const fullSystemPrompt = systemPromptTemplate
          .replace("{{width}}", String(baseSize.width))
          .replace("{{height}}", String(baseSize.height))
          .replace("{{original_prompt}}", rawPrompt);

        try {
          const llmResponse = await queryLLM(
            fullSystemPrompt,
            `Genera el prompt estructurado en JSON para la idea: "${rawPrompt}"`,
            llmSettings,
            true
          );
          finalPrompt = llmResponse.trim();
          params.rawUserPrompt = rawPrompt;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn("[CreativeStudio] Falló la estructuración de Ideogram, usando el prompt estructurado local:", errMsg);
          finalPrompt = ideogramPrompt({
            subject: concept.visualPrompt,
            text: concept.headline,
            subtitle: concept.subtitle,
            ...baseSize,
          });
        }
      }

      const defaultNegative = "duplicate text, repeated words, multiple texts, text overlapping, partial text, text on clothes, text on person, text over body, ugly, distorted text, deformed letters, malformed typography, warped font, fused letters, broken characters, illegible lettering, garbled text, misshapen glyphs, blurry text, misspelled words, extra letters, deformed hands, extra fingers, mutated limbs, bad anatomy, distorted face, low quality, paper brochure artifact, messy collage, extra limbs";
      const cleanedConceptNegative = concept.negativePrompt ? concept.negativePrompt.replace(/\btext\b/gi, "distorted text") : "";
      const finalNegative = cleanedConceptNegative ? `${cleanedConceptNegative}, ${defaultNegative}` : defaultNegative;

      const workflow = gen.buildWorkflow(finalPrompt, params, finalNegative);

      try {
        const result = await comfyGenerate(workflow, generatorId);
        results.push({
          ...concept,
          generator: generatorId,
          generatorName: gen.name,
          generatorReason: ROUTER_REASON[concept.modelHint],
          image: result.image,
          elapsed: result.elapsed,
          promptId: result.promptId,
        });
      } catch (genErr: unknown) {
        const msg = genErr instanceof Error ? genErr.message : String(genErr);
        console.error(`[CreativeStudio] Falló generación de "${concept.conceptName}":`, msg);
        results.push({
          ...concept,
          generator: generatorId,
          generatorName: gen.name,
          generatorReason: ROUTER_REASON[concept.modelHint],
          image: null,
          error: msg,
        });
      }
    }

    return NextResponse.json({
      success: true,
      platform,
      aspectRatio,
      concepts: results,
    });
  } catch (error: unknown) {
    console.error("Error en creative-studio:", error);
    const errObj = error as { message?: string };
    const isRateLimit = errObj?.message?.includes("429");
    return NextResponse.json(
      {
        error: isRateLimit
          ? "Límite de solicitudes del LLM excedido (Error 429). Esperá 1 minuto."
          : errObj?.message || "Error interno en Estudio Creativo",
        detail: String(error),
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}