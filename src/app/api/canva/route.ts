import { exportCanvaImage } from "@/lib/canva-export";
import { writeJson } from "@/lib/json-store";
import { queryLLM } from "@/lib/llm";
import { fetchPublic } from "@/lib/public-fetch";
import fs from "fs";
import { NextRequest,NextResponse } from "next/server";
import path from "path";

// Ruta al archivo de tokens guardado por el servidor de Canva
const TOKENS_PATH = process.env.CANVA_TOKENS_PATH || path.join(process.cwd(), "canva-integration", "server", ".canva-tokens.json");

interface CanvaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function getTokens(): CanvaTokens | null {
  try {
    if (fs.existsSync(/* turbopackIgnore: true */ TOKENS_PATH)) {
      const data = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ TOKENS_PATH, "utf8"));
      if (data.accessToken && data.refreshToken) {
        return data as CanvaTokens;
      }
    }
  } catch (err) {
    console.error("Error reading Canva tokens:", err);
  }
  return null;
}

function saveTokens(tokens: CanvaTokens): void {
  try {
    writeJson(TOKENS_PATH, tokens);
  } catch (err) {
    console.error("Error saving Canva tokens:", err);
  }
}

async function refreshTokens(refreshToken: string): Promise<CanvaTokens> {
  const clientId = process.env.CANVA_CLIENT_ID || "";
  const clientSecret = process.env.CANVA_CLIENT_SECRET || "";

  if (!clientSecret || clientSecret.startsWith("***")) {
    throw new Error("CANVA_CLIENT_SECRET is missing or invalid in .env");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Canva token refresh failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const newTokens: CanvaTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Canva a veces devuelve un nuevo refresh token, si no, mantener el anterior
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveTokens(newTokens);
  return newTokens;
}

async function getValidToken(): Promise<string> {
  const tokens = getTokens();
  if (!tokens) {
    throw new Error("No tokens found. Please connect to Canva first.");
  }

  // Si expira en menos de 5 minutos, refrescar
  if (Date.now() >= tokens.expiresAt - 5 * 60 * 1000) {
    console.log("Canva token is expiring soon, refreshing...");
    const refreshed = await refreshTokens(tokens.refreshToken);
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (!action) {
      return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
    }

    if (action === "proxy-image") {
      const imageUrl = searchParams.get("url");
      if (!imageUrl) {
        return new Response("Missing url parameter", { status: 400 });
      }

      try {
        const token = await getValidToken();
        const result = await fetchPublic(imageUrl, 10_000_000);
        if (!/^image\/(png|jpeg|webp|gif)/.test(result.contentType)) return NextResponse.json({ error: "Formato de imagen no permitido." }, { status: 400 });
        return new NextResponse(new Uint8Array(result.body), { headers: { "Content-Type": result.contentType, "Cache-Control": "private, max-age=300" } });

      } catch (err: any) {
        return new Response(`Error proxying image: ${err.message}`, { status: 500 });
      }
    }

    if (action === "status") {
      const tokens = getTokens();
      if (!tokens) {
        return NextResponse.json({ connected: false });
      }

      // Validar si expira o no
      try {
        const token = await getValidToken();
        return NextResponse.json({ connected: true, expiresAt: tokens.expiresAt });
      } catch (err) {
        return NextResponse.json({ connected: false, error: String(err) });
      }
    }

    if (action === "list") {
      try {
        const token = await getValidToken();
        const query = searchParams.get("query");
        
        const canvaParams = new URLSearchParams();
        if (query) {
          canvaParams.append("query", query);
          canvaParams.append("sort_by", "relevance");
        }
        
        const resp = await fetch(`https://api.canva.com/rest/v1/designs?${canvaParams.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!resp.ok) {
          const errText = await resp.text();
          return NextResponse.json({ error: `Canva API error: ${resp.status}`, detail: errText }, { status: resp.status });
        }

        const data = await resp.json();
        return NextResponse.json({
          success: true,
          designs: data.items || [],
        });
      } catch (err: any) {
        return NextResponse.json({ error: "Error fetching designs", detail: err.message }, { status: 500 });
      }
    }

    if (action === "export") {
      const designId = searchParams.get("designId");
      if (!designId) {
        return NextResponse.json({ error: "Missing designId parameter" }, { status: 400 });
      }

      try {
        const token = await getValidToken();

        const image = await exportCanvaImage(token, designId);
        return NextResponse.json({ success: true, designId, image, title: "Diseño de Canva" });

      } catch (err: any) {
        return NextResponse.json({ error: "Error exporting design", detail: err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, designId, prompt, llmSettings } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action in body" }, { status: 400 });
    }

    if (action === "create") {
      const { title, templateDesignId } = body;
      const designTitle = title || "Diseño editable con IA";

      try {
        const token = await getValidToken();

        const requestBody = templateDesignId
          ? {
              type: "design",
              design_id: templateDesignId,
              title: designTitle,
            }
          : {
              design_type: {
                type: "preset",
                name: "facebook_post",
              },
              title: designTitle,
            };

        const resp = await fetch("https://api.canva.com/rest/v1/designs", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          return NextResponse.json({ error: `Failed to create design in Canva: ${resp.status}`, detail: errText }, { status: resp.status });
        }

        const data = await resp.json();
        return NextResponse.json({
          success: true,
          designId: data.design.id,
          editUrl: data.design.urls.edit_url || data.design.urls.edit,
          design: data.design,
        });

      } catch (err: any) {
        return NextResponse.json({ error: "Error creating Canva design", detail: err.message }, { status: 500 });
      }
    }

    if (action === "edit-with-prompt") {
      if (!designId || !prompt) {
        return NextResponse.json({ error: "Missing designId or prompt parameter" }, { status: 400 });
      }

      try {
        const token = await getValidToken();

        // 1. Obtener el contenido actual del diseño en Canva
        const contentResp = await fetch(`https://api.canva.com/rest/v1/designs/${designId}/content`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!contentResp.ok) {
          const errText = await contentResp.text();
          if (contentResp.status === 404) {
            return NextResponse.json({ 
              error: "Diseño no compatible con edición API", 
              detail: "Canva restringe la API de contenido a formatos compatibles. Diseños creados con elementos web complejos (videos, animaciones o ciertos layouts avanzados) no son legibles por API. Intenta crear un diseño de post de Facebook básico (solo texto e imagen estándar) para probar la IA." 
            }, { status: 404 });
          }
          return NextResponse.json({ error: `Failed to fetch design content from Canva: ${contentResp.status}`, detail: errText }, { status: contentResp.status });
        }

        const designContent = await contentResp.json();

        // 2. Formular prompt del sistema para el LLM
        const systemPrompt = `Sos un asistente de edición estructurado para Canva.
Te proporcionaremos el contenido actual de un diseño de Canva en formato JSON. Este diseño contiene elementos de texto con su 'id' y su valor actual de 'text'.
También te daremos la instrucción del usuario en lenguaje natural sobre qué cambios de texto desea realizar.
Tu tarea es analizar la instrucción y mapearla a operaciones de cambio de texto específicas de Canva.
Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta:
{
  "operations": [
    {
      "type": "update_text",
      "elementId": "el_id_del_elemento_de_texto",
      "text": "el nuevo texto que el usuario quiere colocar"
    }
  ]
}
Reglas críticas:
- Si la instrucción no pide cambiar ningún texto o no se encuentran textos relevantes, devuelve el arreglo "operations" vacío: {"operations": []}.
- El valor 'elementId' DEBE coincidir exactamente con el ID del elemento del JSON de contenido del diseño.
- Solo modifica los textos que el usuario solicita cambiar.
- No devuelvas explicaciones, texto extra o formato Markdown. Solo el objeto JSON crudo.`;

        const userPrompt = `Contenido del diseño actual:
${JSON.stringify(designContent, null, 2)}

Instrucción del usuario:
"${prompt}"`;

        // 3. Consultar al LLM
        console.log("Consultando al LLM con el prompt del usuario...");
        const llmResponse = await queryLLM(systemPrompt, userPrompt, llmSettings);
        console.log("Respuesta del LLM obtenida:", llmResponse);

        let parsedResponse;
        try {
          parsedResponse = JSON.parse(llmResponse.trim());
        } catch (e) {
          return NextResponse.json({ error: "LLM did not return a valid JSON response", raw: llmResponse }, { status: 500 });
        }

        const operations = parsedResponse.operations || [];
        if (operations.length === 0) {
          return NextResponse.json({ success: true, message: "No text operations detected by LLM", operations: [] });
        }

        // 4. Iniciar la transacción de edición en Canva
        console.log(`Iniciando transacción de edición para el diseño ${designId}...`);
        const editStartResp = await fetch(`https://api.canva.com/rest/v1/designs/${designId}/edit`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!editStartResp.ok) {
          const errText = await editStartResp.text();
          return NextResponse.json({ error: `Failed to start Canva editing transaction: ${editStartResp.status}`, detail: errText }, { status: editStartResp.status });
        }

        const editStartData = await editStartResp.json();
        const transactionId = editStartData.transaction_id;
        console.log(`Transacción de edición iniciada. ID: ${transactionId}`);

        try {
          // 5. Aplicar operaciones de texto
          console.log(`Aplicando ${operations.length} operaciones en la transacción...`);
          const opsResp = await fetch(`https://api.canva.com/rest/v1/designs/edit/${transactionId}/operations`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ operations }),
          });

          if (!opsResp.ok) {
            const errText = await opsResp.text();
            throw new Error(`Failed to apply editing operations: ${opsResp.status} - ${errText}`);
          }

          // 6. Confirmar (commit) la transacción
          console.log(`Confirmando transacción de edición ${transactionId}...`);
          const commitResp = await fetch(`https://api.canva.com/rest/v1/designs/edit/${transactionId}/commit`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!commitResp.ok) {
            const errText = await commitResp.text();
            throw new Error(`Failed to commit editing transaction: ${commitResp.status} - ${errText}`);
          }

          console.log("Transacción de edición guardada exitosamente en Canva.");
          return NextResponse.json({
            success: true,
            message: "Design updated successfully with AI",
            operations,
          });

        } catch (txErr: any) {
          // Cancelar transacción en caso de error
          console.error("Error durante la transacción, cancelando...", txErr);
          await fetch(`https://api.canva.com/rest/v1/designs/edit/${transactionId}/cancel`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }).catch((cErr) => console.error("Failed to cancel transaction:", cErr));

          return NextResponse.json({ error: "Failed during design update transaction", detail: txErr.message }, { status: 500 });
        }

      } catch (err: any) {
        return NextResponse.json({ error: "Error processing AI design edit", detail: err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
  }
}
