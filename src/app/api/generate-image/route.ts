import { fetchWithRetry } from "@/lib/fetch-helper";
import { GENERATORS,IDEOGRAM_4_WORKFLOW,buildRichPrompt,type ImageGenerator } from "@/lib/generators";
import { queryLLM } from "@/lib/llm";
import { NextRequest,NextResponse } from "next/server";

const COMFYUI_URL = process.env.COMFYUI_URL || "http://127.0.0.1:8188";

const COMFYUI_TIMEOUT = 15000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      prompt, 
      negativePrompt, 
      generator: genId, 
      width, 
      height, 
      imageSubject, 
      imageText, 
      imageStyle, 
      imageDetails, 
      textLayout,
      dailyVariation,
      textStylePreset,
      imageSubtitle,
      imageSubtitleStyle,
      imageBullets,
      llmSettings, 
      brand,
      geminiApiKey,
      openaiApiKey,
      ...restParams 
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Falta el prompt" }, { status: 400 });
    }

    const isCloud = typeof genId === "string" && (genId.startsWith("gemini-") || genId.startsWith("dall-e-"));
    const generatorId = isCloud ? genId : ((genId && GENERATORS[genId as ImageGenerator]) ? genId : "flux-dev");
    const gen = isCloud ? undefined : GENERATORS[generatorId as ImageGenerator];

    const params: Record<string, number | string> = { ...(gen?.defaultParams || {}) };
    if (width) params.width = width;
    if (height) params.height = height;
    for (const [k, v] of Object.entries(restParams)) {
      if (gen?.defaultParams[k] !== undefined) (params as any)[k] = v as string | number;
    }

    if (generatorId.startsWith("gemini-")) {
      const apiKey = body.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Falta configurar la API Key de Gemini" }, { status: 400 });
      }

      // Calcular aspect ratio para Gemini
      const w = Number(width) || 1024;
      const h = Number(height) || 1024;
      let geminiAspect = "1:1";
      if (w === 768 && h === 1360) {
        geminiAspect = "9:16";
      } else if (w === 768 && h === 1024) {
        geminiAspect = "3:4";
      } else if (w > h) {
        geminiAspect = "16:9";
      } else if (w < h) {
        geminiAspect = "9:16";
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${generatorId}:generateContent?key=${apiKey}`;
      const logUrl = geminiUrl.replace(/key=[^&]+/, "key=***SECRET***");
      const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageGenerationConfig: {
            numberOfImages: 1,
            aspectRatio: geminiAspect,
            mimeType: "image/jpeg"
          }
        }
      };

      console.log(`[Image Gen Request] Model: ${generatorId} | URL: ${logUrl}`);
      console.log(`[Image Gen Request] Body:`, JSON.stringify(requestBody, null, 2));

      let response;
      try {
        response = await fetchWithRetry(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });
      } catch (fetchErr: any) {
        console.error(`[Image Gen Request] Error de conexión física:`, fetchErr);
        return NextResponse.json({ 
          error: "Error de conexión física con Gemini API", 
          detail: fetchErr.message 
        }, { status: 503 });
      }

      console.log(`[Image Gen Response] Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Image Gen Response] Error Body:`, errText);
        let errorMessage = `Error en Gemini API: ${response.status}`;
        let errorDetail = errText;

        if (response.status === 429) {
          errorMessage = "Límite de solicitudes de Gemini excedido (Error 429)";
          errorDetail = "Estás usando una clave gratuita de Gemini API que tiene límites estrictos (por ejemplo, 15 solicitudes por minuto o límite diario), o el servicio está congestionado. Por favor, espera 1 o 2 minutos antes de reintentar, o considera cambiar a un plan de pago o habilitar la facturación en tu consola de Google AI Studio.";
        }

        return NextResponse.json({ error: errorMessage, detail: errorDetail }, { status: response.status });
      }

      const data = await response.json();
      const inlineData = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;

      if (!inlineData || !inlineData.data) {
        return NextResponse.json({ error: "Gemini no devolvió ninguna imagen en la respuesta", detail: data }, { status: 502 });
      }

      const base64Image = `data:${inlineData.mimeType || "image/png"};base64,${inlineData.data}`;

      return NextResponse.json({
        success: true,
        generator: generatorId,
        generator_name: gen?.name || "Google Gemini Imagen",
        image: base64Image,
        imageUrl: base64Image,
        elapsed: "Generación en la Nube",
        prompt_id: "gemini_cloud",
      });
    }

    if (generatorId.startsWith("dall-e-")) {
      const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Falta configurar la API Key de OpenAI" }, { status: 400 });
      }

      const openaiUrl = "https://api.openai.com/v1/images/generations";
      
      // Mapear resoluciones para DALL-E
      let sizeStr = "1024x1024";
      if (generatorId === "dall-e-3") {
        const w = Number(params.width) || 1024;
        const h = Number(params.height) || 1024;
        if (w > h) {
          sizeStr = "1792x1024";
        } else if (w < h) {
          sizeStr = "1024x1792";
        }
      } else {
        // DALL-E 2
        sizeStr = `${params.width || 1024}x${params.height || 1024}`;
      }

      const response = await fetch(openaiUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: generatorId,
          prompt: prompt,
          n: 1,
          size: sizeStr,
          quality: params.quality || undefined,
          response_format: "b64_json"
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json({ error: `Error en OpenAI API: ${response.status}`, detail: errText }, { status: response.status });
      }

      const data = await response.json();
      const b64Data = data.data?.[0]?.b64_json;

      if (!b64Data) {
        return NextResponse.json({ error: "OpenAI no devolvió ninguna imagen en formato b64_json", detail: data }, { status: 502 });
      }

      const base64Image = `data:image/png;base64,${b64Data}`;

      return NextResponse.json({
        success: true,
        generator: generatorId,
        generator_name: gen?.name || "OpenAI DALL-E",
        image: base64Image,
        imageUrl: base64Image,
        elapsed: "Generación en la Nube",
        prompt_id: "openai_cloud",
      });
    }

    if (!gen) {
      return NextResponse.json({ error: "Generador no soportado o no disponible" }, { status: 400 });
    }

    // Para Ideogram 4, construir prompt estructurado JSON llamando al LLM
    let finalPrompt = prompt;
    let rawPrompt = prompt;

    if (generatorId === "ideogram-4") {
      // 1. Obtener la plantilla oficial de prompt desde el JSON del flujo
      const systemPromptTemplate = IDEOGRAM_4_WORKFLOW["134:114"]?.inputs?.value || "";
      
      // 2. Construir prompt plano legible
      rawPrompt = buildRichPrompt(
        imageSubject || "",
        imageText || "",
        imageStyle || "ninguno",
        imageDetails || "",
        textLayout || "ninguno",
        dailyVariation || "ninguno",
        textStylePreset || "modern-white",
        imageSubtitle || "",
        imageSubtitleStyle || "clean-white",
        imageBullets || "",
        brand ? {
          name: brand.name,
          guidelines: brand.brandGuidelines,
          voiceTone: brand.voiceTone,
          colors: brand.colors,
          typography: brand.typography,
          projectDescription: brand.projectDescription,
          targetAudience: brand.targetAudience,
          valueProposition: brand.valueProposition,
          styleAspects: brand.styleAspects
        } : undefined
      );

      // 3. Remplazar marcadores en la plantilla
      const w = width || 1024;
      const h = height || 1024;
      const fullSystemPrompt = systemPromptTemplate
        .replace("{{width}}", String(w))
        .replace("{{height}}", String(h))
        .replace("{{original_prompt}}", rawPrompt);

      try {
        console.log("Generando prompt estructurado JSON mediante el LLM...");
        const llmResponse = await queryLLM(
          fullSystemPrompt,
          `Genera el prompt estructurado en JSON para la idea: "${rawPrompt}"`,
          llmSettings,
          true
        );
        finalPrompt = llmResponse.trim();
        console.log("Prompt estructurado JSON obtenido del LLM.");
      } catch (err: any) {
        console.warn("Fallo al llamar al LLM para expansión de prompt, cayendo a texto plano: ", err.message);
        finalPrompt = rawPrompt;
      }
      
      params.rawUserPrompt = rawPrompt;
    }

    // Construir workflow con prompt final y negative prompt reforzado
    const defaultNegative = "duplicate text, repeated words, multiple texts, text overlapping, partial text, text on clothes, text on person, text over body, ugly, distorted text, deformed letters, malformed typography, warped font, fused letters, broken characters, illegible lettering, garbled text, misshapen glyphs, blurry text, misspelled words, extra letters, deformed hands, extra fingers, mutated limbs, bad anatomy, distorted face, low quality, paper brochure artifact, messy collage, extra limbs";
    const cleanedUserNegative = negativePrompt ? String(negativePrompt).replace(/\btext\b/gi, "distorted text") : "";
    const finalNegative = cleanedUserNegative ? `${cleanedUserNegative}, ${defaultNegative}` : defaultNegative;
    const workflow = gen.buildWorkflow(finalPrompt, params, finalNegative);

    // Pre-check: verificar que ComfyUI esté respondiendo antes de enviar workflow
    try {
      const healthController = new AbortController();
      const healthTimeoutId = setTimeout(() => healthController.abort(), COMFYUI_TIMEOUT);
      const healthResp = await fetch(`${COMFYUI_URL}/system_stats`, {
        signal: healthController.signal,
      });
      clearTimeout(healthTimeoutId);
      if (!healthResp.ok) {
        return NextResponse.json({
          error: "ComfyUI no responde correctamente",
          detail: `ComfyUI respondió con estado ${healthResp.status}. El servidor podría estar en un estado inválido. Verificá el dashboard de ComfyUI.`,
        }, { status: 503 });
      }
    } catch (healthErr: any) {
      const isAbort = healthErr.name === "AbortError";
      return NextResponse.json({
        error: "ComfyUI no está corriendo",
        detail: isAbort
          ? `Timeout (${COMFYUI_TIMEOUT}ms) intentando conectar con ComfyUI en ${COMFYUI_URL}. Verificá que el servidor esté encendido y escuchando.`
          : `No se pudo conectar con ComfyUI en ${COMFYUI_URL}. ${healthErr.message}. Asegúrate de que ComfyUI esté corriendo (hacé clic en "Usar ComfyUI" en el panel).`,
      }, { status: 503 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), COMFYUI_TIMEOUT);

    // Interrumpir cualquier ejecución activa y limpiar cola de ComfyUI antes de enviar
    try {
      await fetch(`${COMFYUI_URL}/interrupt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
    } catch (interruptErr: any) {
      if (interruptErr.name !== "AbortError") {
        console.warn(`[ComfyUI] Error al interrumpir: ${interruptErr.message}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }

    const queueController = new AbortController();
    const queueTimeoutId = setTimeout(() => queueController.abort(), COMFYUI_TIMEOUT);
    try {
      await fetch(`${COMFYUI_URL}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
        signal: queueController.signal,
      });
    } catch (queueErr: any) {
      if (queueErr.name !== "AbortError") {
        console.warn(`[ComfyUI] Error al limpiar cola: ${queueErr.message}`);
      }
    } finally {
      clearTimeout(queueTimeoutId);
    }

    // Enviar a ComfyUI
    const promptController = new AbortController();
    const promptTimeoutId = setTimeout(() => promptController.abort(), COMFYUI_TIMEOUT);
    let queueResp: Response;
    try {
      queueResp = await fetch(`${COMFYUI_URL}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow }),
        signal: promptController.signal,
      });
    } catch (promptErr: any) {
      clearTimeout(promptTimeoutId);
      const detail = promptErr.name === "AbortError"
        ? `Timeout de red (${COMFYUI_TIMEOUT}ms) intentando conectar con ComfyUI en ${COMFYUI_URL}. Verificá que el servidor esté encendido y escuchando en esa dirección.`
        : `No se pudo conectar con ComfyUI en ${COMFYUI_URL}: ${promptErr.message}`;
      return NextResponse.json({ error: "Error de conexión con ComfyUI", detail }, { status: 503 });
    } finally {
      clearTimeout(promptTimeoutId);
    }

    if (!queueResp.ok) {
      const errText = await queueResp.text();
      return NextResponse.json({ error: "ComfyUI rechazó el workflow", detail: errText }, { status: 502 });
    }

    const queueData = await queueResp.json();
    const promptId = queueData.prompt_id;

    if (!promptId) {
      return NextResponse.json({ error: "No se obtuvo prompt_id", detail: queueData }, { status: 502 });
    }

    // Poll hasta que termine (5 minutos máximo)
    const startTime = Date.now();
    const maxWait = 300000; // 5 min

    while (Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      let historyResp: Response;
      try {
        historyResp = await fetch(`${COMFYUI_URL}/history/${promptId}`, {
          signal: AbortSignal.timeout(10000),
        });
      } catch (historyErr: any) {
        if (historyErr.name === "AbortError") {
          console.warn(`[ComfyUI] Timeout consultando history/${promptId}, reintentando...`);
          continue;
        }
        throw new Error(`Error consultando estado de ComfyUI: ${historyErr.message}`);
      }

      const historyData = await historyResp.json();

      if (historyData[promptId]) {
        const outputs = historyData[promptId].outputs;

        // Buscar imagen: nodo de SaveImage según el generador actual
        const saveNodeForGenerator: Record<string, string> = {
          "flux-dev": "9",
          "flux-2-klein": "9",
          "realvis-xl": "9",
          "z-image-turbo": "10",
          "ideogram-4": "158",
        };

        const saveNodeId = saveNodeForGenerator[generatorId] || "9";
        const nodesToCheck = Array.from(new Set([saveNodeId, "9", "10", "158"]));

        for (const nodeId of nodesToCheck) {
          if (outputs[nodeId]?.images?.[0]) {
            const img = outputs[nodeId].images[0];
            const imageUrl = `${COMFYUI_URL}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${encodeURIComponent(img.type || "output")}`;

            const imgController = new AbortController();
            const imgTimeoutId = setTimeout(() => imgController.abort(), COMFYUI_TIMEOUT);
            let imgResp: Response;
            try {
              imgResp = await fetch(imageUrl, { signal: imgController.signal });
            } catch (imgErr: any) {
              console.warn(`[ComfyUI] Error obteniendo imagen del nodo ${nodeId}: ${imgErr.message}`);
              continue;
            } finally {
              clearTimeout(imgTimeoutId);
            }

            if (!imgResp.ok) {
              console.warn(`[ComfyUI] HTTP ${imgResp.status} obteniendo imagen del nodo ${nodeId}`);
              continue;
            }

            const arrayBuffer = await imgResp.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = `data:image/png;base64,${buffer.toString("base64")}`;

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

            return NextResponse.json({
              success: true,
              generator: generatorId,
              generator_name: gen.name,
              image: base64,
              imageUrl: base64,
              elapsed: `${elapsed}s`,
              prompt_id: promptId,
            });
          }
        }

        if (historyData[promptId].status?.status_str === "error") {
          const messages = historyData[promptId].status?.messages || [];
          return NextResponse.json({ error: "ComfyUI falló", messages }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ error: `Timeout (5min) esperando a ${gen.name}` }, { status: 504 });
  } catch (err) {
    return NextResponse.json(
      { error: "Error al conectar con ComfyUI", detail: String(err) },
      { status: 503 }
    );
  }
}
