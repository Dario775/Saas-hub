import { fetchWithRetry } from "./fetch-helper";

export type LLMProvider =
  | "openrouter"
  | "ollama"
  | "gemini"
  | "openai"
  | "deepseek";

export interface LLMSettings {
  provider?: LLMProvider;
  openrouterKey?: string;
  openrouterModel?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  deepseekApiKey?: string;
  deepseekModel?: string;
}

/**
 * Valores por defecto de cada proveedor de IA.
 * Única fuente para el modelo y el endpoint por defecto de los proveedores nuevos.
 */
export const LLM_DEFAULTS: Record<
  LLMProvider,
  { model: string; url: string; label: string }
> = {
  openrouter: {
    model: "google/gemini-2.5-flash:free",
    url: "https://openrouter.ai/api/v1/chat/completions",
    label: "OpenRouter",
  },
  openai: {
    model: "gpt-4o-mini",
    url: "https://api.openai.com/v1/chat/completions",
    label: "OpenAI",
  },
  gemini: {
    model: "gemini-2.5-flash",
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    label: "Google Gemini",
  },
  deepseek: {
    model: "deepseek-flash",
    url: "https://api.deepseek.com/chat/completions",
    label: "DeepSeek",
  },
  ollama: {
    model: "llama3",
    url: "http://127.0.0.1:11434",
    label: "Ollama (local)",
  },
};

/** Proveedor y modelo efectivos según la configuración y el entorno, sin llamar a ninguna API. */
export function resolveLLMConfig(settings?: LLMSettings): {
  provider: LLMProvider;
  model: string;
} {
  const provider: LLMProvider =
    settings?.provider ||
    (process.env.LLM_PROVIDER as LLMProvider) ||
    "openrouter";

  if (provider === "openai")
    return {
      provider,
      model:
        settings?.openaiModel ||
        process.env.OPENAI_MODEL ||
        LLM_DEFAULTS.openai.model,
    };
  if (provider === "gemini")
    return {
      provider,
      model:
        settings?.geminiModel ||
        process.env.GEMINI_MODEL ||
        LLM_DEFAULTS.gemini.model,
    };
  if (provider === "openrouter")
    return {
      provider,
      model:
        settings?.openrouterModel ||
        process.env.OPENROUTER_MODEL ||
        LLM_DEFAULTS.openrouter.model,
    };
  if (provider === "deepseek")
    return {
      provider,
      model:
        settings?.deepseekModel ||
        process.env.DEEPSEEK_MODEL ||
        LLM_DEFAULTS.deepseek.model,
    };
  return {
    provider,
    model:
      settings?.ollamaModel ||
      process.env.LOCAL_LLM_MODEL ||
      LLM_DEFAULTS.ollama.model,
  };
}

export async function queryLLM(
  systemPrompt: string,
  userPrompt: string,
  settings?: LLMSettings,
  expectJson: boolean = true
): Promise<string> {
  // Combinar settings personalizadas con variables de entorno de fallback
  const provider: LLMProvider =
    settings?.provider ||
    (process.env.LLM_PROVIDER as LLMProvider) ||
    "openrouter";
  
  let url = "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let body: any = {};

  if (provider === "openai") {
    const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY || "";
    const model = settings?.openaiModel || process.env.OPENAI_MODEL || "gpt-4o-mini";
    
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    
    body = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    };

    if (expectJson) {
      body.response_format = { type: "json_object" };
    }
  } else if (provider === "deepseek") {
    const apiKey = settings?.deepseekApiKey || process.env.DEEPSEEK_API_KEY || "";
    const model =
      settings?.deepseekModel ||
      process.env.DEEPSEEK_MODEL ||
      LLM_DEFAULTS.deepseek.model;

    if (!apiKey.trim()) {
      throw new Error(
        "Falta DEEPSEEK_API_KEY: guardala en la configuración de IA del panel o en .env.local para usar DeepSeek.",
      );
    }

    url = LLM_DEFAULTS.deepseek.url;
    headers["Authorization"] = `Bearer ${apiKey}`;

    body = {
      model: model,
      messages: [
        {
          role: "system",
          content: expectJson
            ? systemPrompt + "\nResponde unicamente con un objeto JSON valido."
            : systemPrompt,
        },
        { role: "user", content: userPrompt },
      ],
    };

    if (expectJson) {
      body.response_format = { type: "json_object" };
    }

    // El razonamiento extendido se habilita con DEEPSEEK_THINKING=true (más lento y más caro).
    if (process.env.DEEPSEEK_THINKING === "true") {
      body.thinking = { type: "enabled" };
    }
  } else if (provider === "gemini") {
    const apiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY || "";
    const model = settings?.geminiModel || process.env.GEMINI_MODEL || "gemini-2.5-flash";
    
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: userPrompt }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          { text: systemPrompt }
        ]
      }
    };

    if (expectJson) {
      body.generationConfig = {
        responseMimeType: "application/json"
      };
    }
  } else if (provider === "openrouter") {
    const apiKey = settings?.openrouterKey || process.env.OPENROUTER_API_KEY || "";
    const model = settings?.openrouterModel || process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash:free";
    
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    
    body = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    };

    if (expectJson) {
      body.response_format = { type: "json_object" };
    }
  } else {
    // Local: Ollama
    const localHost = settings?.ollamaUrl || process.env.LOCAL_LLM_URL || "http://127.0.0.1:11434";
    // Normalizar URL a base sin /v1
    const cleanHost = localHost.replace(/localhost/g, "127.0.0.1").replace(/\/v1\/?$/, "").replace(/\/api\/?$/, "").replace(/\/$/, "");
    const model = settings?.ollamaModel || process.env.LOCAL_LLM_MODEL || "llama3";
    
    url = `${cleanHost}/api/chat`;
    
    body = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt + (expectJson ? "\nTu respuesta DEBE ser estrictamente un JSON válido." : "") },
        { role: "user", content: userPrompt }
      ],
      stream: false,
    };

    if (expectJson) {
      body.format = "json";
    }
  }


  let response;
  try {
    response = await fetchWithRetry(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (fetchErr: any) {
    console.error(`[LLM Request] Error de conexión física (fetch falló):`, fetchErr);
    if (provider === "ollama") {
      throw new Error(`No se pudo conectar con Ollama en ${url}. Asegúrate de que Ollama esté iniciado ('ollama serve' o aplicación abierta).`);
    }
    throw new Error(`Error de conexión física con el proveedor de IA (${provider}): ${fetchErr.message}`);
  }


  if (!response.ok) {
    const errText = await response.text();
    console.error(`[LLM Response] Error Body:`, errText);
    if (provider === "deepseek") {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "DeepSeek rechazó la credencial (" +
            response.status +
            "). Revisá DEEPSEEK_API_KEY en la configuración de IA.",
        );
      }
      if (response.status === 402) {
        throw new Error(
          "DeepSeek no tiene saldo disponible (402). Cargá crédito en platform.deepseek.com.",
        );
      }
      if (response.status === 400) {
        throw new Error(
          "DeepSeek rechazó la solicitud (400): " + errText.slice(0, 300),
        );
      }
    }
    if (response.status === 429) {
      throw new Error(`El proveedor de IA alcanzó su límite de solicitudes. Esperá unos segundos o revisá la cuota de tu cuenta.`);
    }
    throw new Error(`Error en llamada a LLM (${provider}): ${response.status} - ${errText}`);
  }

  const data = await response.json();
  let text = "";

  if (provider === "gemini") {
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = data.candidates[0].content.parts[0].text;
    } else {
      throw new Error(`Respuesta inválida de Gemini: ${JSON.stringify(data)}`);
    }
  } else if (provider === "ollama") {
    if (data.message?.content) {
      text = data.message.content;
    } else if (data.choices?.[0]?.message?.content) {
      text = data.choices[0].message.content;
    } else {
      throw new Error(`Respuesta inválida de Ollama: ${JSON.stringify(data)}`);
    }
  } else {
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Formato de respuesta inválido del LLM");
    }
    text = data.choices[0].message.content || "";
  }
  
  // Limpiar posibles bloques de código markdown que algunos LLMs insertan aun pidiendo json_object
  if (expectJson) {
    text = text.trim();
    if (text.startsWith("```")) {
      // Remover bloques del tipo ```json ... ```
      text = text.replace(/^```[a-zA-Z]*\n?/, "");
      text = text.replace(/\n?```$/, "");
      text = text.trim();
    }
  }

  return text;
}
