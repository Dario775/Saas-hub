import { queryLLM } from "@/lib/llm"; // Forzando recarga de Next.js
import { fetchPublic } from "@/lib/public-fetch";
import { NextRequest, NextResponse } from "next/server";

interface ExtractedLogos {
  logoDataUrl?: string;
  secondaryLogoUrl?: string;
}

async function fetchImageAsDataUrl(candidateUrl: string): Promise<string | null> {
  try {
    const res = await fetchPublic(candidateUrl, 1_500_000);
    if (!res.body || res.body.length === 0) return null;
    let mime = res.contentType || "image/png";
    if (mime.includes(";")) mime = mime.split(";")[0].trim();

    const cleanUrl = candidateUrl.split("?")[0].toLowerCase();
    if (cleanUrl.endsWith(".svg")) mime = "image/svg+xml";
    else if (cleanUrl.endsWith(".png")) mime = "image/png";
    else if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) mime = "image/jpeg";
    else if (cleanUrl.endsWith(".webp")) mime = "image/webp";
    else if (cleanUrl.endsWith(".ico")) mime = "image/x-icon";

    return `data:${mime};base64,${res.body.toString("base64")}`;
  } catch {
    return null;
  }
}

async function extractBrandLogos(html: string, targetUrl: string): Promise<ExtractedLogos> {
  const result: ExtractedLogos = {};

  const baseTagMatch = html.match(/<base\s+[^>]*href=["']([^"']+)["']/i);
  const resolvedBaseUrl = baseTagMatch ? new URL(baseTagMatch[1], targetUrl).href : targetUrl;

  const resolve = (rel: string) => {
    try {
      return new URL(rel, resolvedBaseUrl).href;
    } catch {
      return null;
    }
  };

  const headerMatch = html.match(/<(header|nav)\b[^>]*>([\s\S]*?)<\/\1>/i);
  const headerHtml = headerMatch ? headerMatch[0] : "";

  const candidates: { url?: string; svg?: string; score: number }[] = [];

  // 1. Inline SVGs inside header/nav or with logo in class/id
  const svgRegex = /<svg\b[^>]*>([\s\S]*?)<\/svg>/gi;
  const svgScope = headerHtml || html;
  let sMatch;
  let svgCount = 0;
  while ((sMatch = svgRegex.exec(svgScope)) !== null && svgCount < 10) {
    svgCount++;
    const fullSvg = sMatch[0];
    if (fullSvg.length > 50000) continue;
    const isExplicit = /(?:class|id|aria-label)=["'][^"']*(?:logo|brand)[^"']*["']/i.test(fullSvg);
    if (isExplicit) {
      candidates.push({ svg: fullSvg, score: 30 });
    } else if (headerHtml && fullSvg.includes("<path")) {
      candidates.push({ svg: fullSvg, score: 10 });
    }
  }

  // 2. <img> tags
  const imgRegex = /<img\b([^>]*)>/gi;
  let iMatch;
  let imgCount = 0;
  while ((iMatch = imgRegex.exec(html)) !== null && imgCount < 50) {
    imgCount++;
    const attrs = iMatch[1];
    const srcMatch = attrs.match(/(?:src|data-src)=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const rawSrc = srcMatch[1];

    if (rawSrc.startsWith("data:image/")) {
      if (/logo|brand|isologo|isotipo/i.test(attrs)) {
        candidates.push({ url: rawSrc, score: 35 });
      }
      continue;
    }

    const resolved = resolve(rawSrc);
    if (!resolved) continue;

    let score = 0;
    const lowerAttrs = attrs.toLowerCase();
    const lowerSrc = rawSrc.toLowerCase();

    if (lowerAttrs.includes("logo") || lowerSrc.includes("logo")) score += 25;
    if (lowerAttrs.includes("brand") || lowerSrc.includes("brand")) score += 15;
    if (lowerAttrs.includes("isotipo") || lowerAttrs.includes("isologo")) score += 20;
    if (headerHtml && headerHtml.includes(rawSrc)) score += 10;
    if (lowerSrc.endsWith(".svg")) score += 8;
    else if (lowerSrc.endsWith(".png")) score += 5;
    else if (lowerSrc.endsWith(".webp")) score += 3;

    if (score > 0) {
      candidates.push({ url: resolved, score });
    }
  }

  // 3. OpenGraph / Twitter Image fallback
  const ogMatch =
    html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatch) {
    const resolved = resolve(ogMatch[1]);
    if (resolved) candidates.push({ url: resolved, score: 5 });
  }

  // Sort candidates by score
  candidates.sort((a, b) => b.score - a.score);

  // Download best candidate
  for (const cand of candidates.slice(0, 3)) {
    if (cand.svg) {
      let svgContent = cand.svg.trim();
      if (!svgContent.includes("xmlns=")) {
        svgContent = svgContent.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      result.logoDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString("base64")}`;
      break;
    } else if (cand.url) {
      if (cand.url.startsWith("data:image/")) {
        result.logoDataUrl = cand.url;
        break;
      }
      const fetched = await fetchImageAsDataUrl(cand.url);
      if (fetched) {
        result.logoDataUrl = fetched;
        break;
      }
    }
  }

  // 4. Extract Favicon / Apple-touch-icon for secondary logo
  const iconPatterns = [
    /<link\s+[^>]*rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["'][^>]*href=["']([^"']+)["']/i,
    /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["']/i,
    /<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i,
    /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i,
  ];

  let iconUrl: string | null = null;
  for (const pattern of iconPatterns) {
    const match = html.match(pattern);
    if (match) {
      iconUrl = resolve(match[1]);
      if (iconUrl) break;
    }
  }

  if (!iconUrl) {
    iconUrl = resolve("/favicon.ico");
  }

  if (iconUrl) {
    const fetchedIcon = await fetchImageAsDataUrl(iconUrl);
    result.secondaryLogoUrl = fetchedIcon || iconUrl;
    if (!result.logoDataUrl && fetchedIcon) {
      result.logoDataUrl = fetchedIcon;
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { url, llmSettings } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "Falta la URL de la marca." }, { status: 400 });
    }

    if (!llmSettings) {
      return NextResponse.json({ error: "Configuración de LLM no proporcionada." }, { status: 400 });
    }

    const targetUrl = url.startsWith("http") ? url : `https://${url}`;

    // 1. Scraping Nativo: Descargar el HTML de la web
    let html = "";
    try {
      const result = await fetchPublic(targetUrl);
      html = result.body.toString("utf8");
    } catch (fetchErr: any) {
      return NextResponse.json({ error: `No se pudo acceder a la URL: ${fetchErr.message}` }, { status: 400 });
    }

    // 2. Extraer activos visuales (Logos / Favicons / SVGs) antes de limpiar el HTML
    const logosPromise = extractBrandLogos(html, targetUrl);

    // 3. Limpieza básica del HTML (sin librerías pesadas)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : "";

    let cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    cleanText = cleanText.substring(0, 15000);

    // 4. Prompting: Pedirle al LLM que analice semánticamente
    const systemPrompt = `Eres un Director de Arte y Analista de Marketing. 
Tu tarea es analizar el texto extraído de una página web corporativa y deducir la identidad de la marca.
Debes devolver ÚNICAMENTE un objeto JSON válido con esta estructura exacta, sin backticks ni markdown:
{
  "brandName": "El nombre oficial de la marca o empresa extraído de la web",
  "projectDescription": "Breve descripción de a qué se dedica la empresa (máx 3 líneas)",
  "targetAudience": "Descripción detallada del público objetivo ideal (edad, intereses, B2B/B2C, rol)",
  "valueProposition": "La propuesta de valor principal (qué dolor solucionan y cómo)",
  "voiceTone": "El tono de voz con el que deben escribir (ej: Corporativo y distante, Amigable y tuteando, Juvenil y rebelde)",
  "brandKeywords": "5 palabras clave que definan la personalidad de la marca (ej: Innovador, Velocidad, Seguridad)",
  "colors": {
    "primary": ["#HEX1"],
    "secondary": ["#HEX2"]
  },
  "typography": {
    "heading": "Nombre de fuente sugerida para títulos (ej: Montserrat)",
    "body": "Nombre de fuente sugerida para párrafos (ej: Inter)"
  },
  "brandGuidelines": "3 directrices estrictas de diseño para generación de imágenes (ej: Usar mucho espacio en blanco, iluminación cálida, estilo flat minimalista)"
}

Si el sitio no menciona colores específicos, infiérelos por el rubro o sugiere colores psicológicamente adecuados (ej: azul para tecnología/salud).`;

    const userPrompt = `Título Web: ${title}\nDescripción SEO: ${description}\n\nContenido de la web:\n${cleanText}\n\nAnaliza la marca y devuelve el JSON.`;

    // 5. Ejecutar LLM y extracción de logos concurrentemente
    const [llmResult, extractedLogos] = await Promise.allSettled([
      queryLLM(systemPrompt, userPrompt, llmSettings, true),
      logosPromise,
    ]);

    if (llmResult.status === "rejected") {
      throw new Error(`Error en el proveedor de IA: ${llmResult.reason?.message || llmResult.reason}`);
    }

    const llmResponse = llmResult.value;

    // 6. Parsear el resultado del LLM
    let parsedData: any;
    try {
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No se encontró ningún objeto JSON en la respuesta.");
      }
      parsedData = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      return NextResponse.json({ error: "El LLM no devolvió un JSON válido.", raw: llmResponse }, { status: 500 });
    }

    // 7. Adjuntar logos extraídos
    if (extractedLogos.status === "fulfilled") {
      if (extractedLogos.value.logoDataUrl) {
        parsedData.logoDataUrl = extractedLogos.value.logoDataUrl;
      }
      if (extractedLogos.value.secondaryLogoUrl) {
        parsedData.secondaryLogoUrl = extractedLogos.value.secondaryLogoUrl;
      }
    }

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error(error);
    const isRateLimit = error.message?.includes("429");
    const status = isRateLimit ? 429 : 500;
    const errorMsg = isRateLimit 
      ? "Límite de solicitudes de Gemini excedido (Error 429)" 
      : (error.message || "Error interno del servidor");
    return NextResponse.json(
      { error: errorMsg, detail: error.message },
      { status }
    );
  }
}
