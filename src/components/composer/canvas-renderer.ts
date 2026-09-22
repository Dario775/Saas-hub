import { BackgroundLayer,BrandLogoLayer,CanvasDimensions,CanvasLayer,ImageLayer,ShapeLayer,TextLayer } from "./types";

// Cache para imágenes cargadas en memoria para evitar re-cargas continuas
const imageCache = new Map<string, HTMLImageElement>();

export function preloadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    const cached = imageCache.get(src)!;
    if (cached.complete) return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (err) => {
      console.warn("Error cargando imagen para canvas:", src, err);
      reject(err);
    };
    img.src = src;
  });
}

/**
 * Remueve el fondo sólido de una imagen convirtiéndola en un PNG transparente con bordes suavizados
 */
export async function removeSolidBackground(
  imageSrc: string,
  tolerance: number = 45
): Promise<string> {
  try {
    const img = await preloadImage(imageSrc);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return imageSrc;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    // Tomar muestra del color de fondo promediando las 4 esquinas de la imagen
    const corners = [
      0, // top-left
      Math.max(0, (w - 1) * 4), // top-right
      Math.max(0, (h - 1) * w * 4), // bottom-left
      Math.max(0, ((h - 1) * w + (w - 1)) * 4), // bottom-right
    ];

    let bgR = 0, bgG = 0, bgB = 0;
    for (const c of corners) {
      bgR += data[c] || 0;
      bgG += data[c + 1] || 0;
      bgB += data[c + 2] || 0;
    }
    bgR = bgR / corners.length;
    bgG = bgG / corners.length;
    bgB = bgB / corners.length;

    // Aplicar distancia euclidiana y difuminado alpha
    const feather = Math.max(10, tolerance * 0.4);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const dist = Math.sqrt(
        Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
      );

      if (dist < tolerance - feather) {
        data[i + 3] = 0; // 100% transparente
      } else if (dist < tolerance + feather) {
        const factor = (dist - (tolerance - feather)) / (feather * 2);
        data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, factor))); // Suavizado de bordes
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const result = canvas.toDataURL("image/png");
    return result;
  } catch (err) {
    console.error("Error al remover fondo:", err);
    return imageSrc;
  }
}

/**
 * Renderiza todas las capas activas sobre un HTMLCanvasElement
 */
export async function renderLayersToCanvas(
  canvas: HTMLCanvasElement,
  layers: CanvasLayer[],
  dimensions: CanvasDimensions,
  brandLogosMap?: Record<string, string>
): Promise<void> {
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  // Limpiar canvas
  ctx.clearRect(0, 0, dimensions.width, dimensions.height);

  // Asegurar que las fuentes estén listas en el navegador
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Continuar si falla
    }
  }

  // Pre-cargar todas las imágenes que contengan las capas visibles
  const imagePromises: Promise<any>[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    if (layer.type === "background" && layer.fillType === "image" && layer.imageUrl) {
      imagePromises.push(preloadImage(layer.imageUrl).catch(() => null));
    } else if (layer.type === "image" && layer.imageUrl) {
      imagePromises.push(preloadImage(layer.imageUrl).catch(() => null));
    } else if (layer.type === "brand-logo") {
      const src = layer.customDataUrl || (brandLogosMap && layer.brandId ? getSvgDataUrl(brandLogosMap[layer.brandId] || "") : "");
      if (src) imagePromises.push(preloadImage(src).catch(() => null));
    }
  }
  await Promise.all(imagePromises);

  // Dibujar capas en orden (de abajo hacia arriba)
  for (const layer of layers) {
    if (!layer.visible) continue;

    ctx.save();

    // Opacidad global de capa
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity ?? 1));

    // Modo de fusión
    if (layer.blendMode && layer.blendMode !== "normal") {
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
    }

    switch (layer.type) {
      case "background":
        await drawBackgroundLayer(ctx, layer, dimensions);
        break;
      case "image":
        await drawImageLayer(ctx, layer);
        break;
      case "shape":
        drawShapeLayer(ctx, layer);
        break;
      case "text":
        drawTextLayer(ctx, layer);
        break;
      case "brand-logo":
        await drawBrandLogoLayer(ctx, layer, brandLogosMap);
        break;
    }

    ctx.restore();
  }
}

function getSvgDataUrl(svgString: string): string {
  if (!svgString) return "";
  if (svgString.startsWith("data:") || svgString.startsWith("http") || svgString.startsWith("/")) return svgString;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

async function drawBackgroundLayer(
  ctx: CanvasRenderingContext2D,
  layer: BackgroundLayer,
  dim: CanvasDimensions
) {
  if (layer.fillType === "color") {
    ctx.fillStyle = layer.color || "#090d16";
    ctx.fillRect(0, 0, dim.width, dim.height);
  } else if (layer.fillType === "gradient") {
    const angleRad = ((layer.gradientAngle ?? 135) * Math.PI) / 180;
    const x1 = dim.width / 2 - (Math.cos(angleRad) * dim.width) / 2;
    const y1 = dim.height / 2 - (Math.sin(angleRad) * dim.height) / 2;
    const x2 = dim.width / 2 + (Math.cos(angleRad) * dim.width) / 2;
    const y2 = dim.height / 2 + (Math.sin(angleRad) * dim.height) / 2;

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, layer.gradientStart || "#0f172a");
    grad.addColorStop(1, layer.gradientEnd || "#020617");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dim.width, dim.height);
  } else if (layer.fillType === "image" && layer.imageUrl) {
    try {
      const img = await preloadImage(layer.imageUrl);
      drawCoverImage(ctx, img, 0, 0, dim.width, dim.height);
    } catch {
      // Fallback a color oscuro si la imagen falla
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, dim.width, dim.height);
    }
  }
}

async function drawImageLayer(ctx: CanvasRenderingContext2D, layer: ImageLayer) {
  if (!layer.imageUrl) return;

  try {
    const img = await preloadImage(layer.imageUrl);
    const { x, y, width, height, rotation = 0 } = layer;

    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    if (rotation) ctx.rotate((rotation * Math.PI) / 180);

    // Sombra si está configurada
    if (layer.shadowBlur && layer.shadowBlur > 0) {
      ctx.shadowColor = layer.shadowColor || "rgba(0,0,0,0.5)";
      ctx.shadowBlur = layer.shadowBlur;
      ctx.shadowOffsetX = layer.shadowOffsetX || 0;
      ctx.shadowOffsetY = layer.shadowOffsetY || 4;
    }

    // Bordes redondeados con clipping
    if (layer.borderRadius && layer.borderRadius > 0) {
      ctx.beginPath();
      roundRectPath(ctx, -width / 2, -height / 2, width, height, layer.borderRadius);
      ctx.clip();
    }

    // Dibujar imagen con fit
    if (layer.objectFit === "contain") {
      drawContainImage(ctx, img, -width / 2, -height / 2, width, height);
    } else if (layer.objectFit === "fill") {
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
    } else {
      drawCoverImage(ctx, img, -width / 2, -height / 2, width, height);
    }

    // Borde exterior si está configurado
    if (layer.borderWidth && layer.borderWidth > 0 && layer.borderColor) {
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = layer.borderColor;
      ctx.lineWidth = layer.borderWidth;
      ctx.beginPath();
      if (layer.borderRadius) {
        roundRectPath(ctx, -width / 2, -height / 2, width, height, layer.borderRadius);
      } else {
        ctx.rect(-width / 2, -height / 2, width, height);
      }
      ctx.stroke();
    }

    ctx.restore();
  } catch (err) {
    console.warn("Fallo al dibujar capa de imagen:", err);
  }
}

function drawShapeLayer(ctx: CanvasRenderingContext2D, layer: ShapeLayer) {
  const { x, y, width, height, rotation = 0 } = layer;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);

  if (layer.shadowBlur && layer.shadowBlur > 0) {
    ctx.shadowColor = layer.shadowColor || "rgba(0,0,0,0.4)";
    ctx.shadowBlur = layer.shadowBlur;
  }

  // Configurar relleno
  if (layer.fillType === "gradient" && layer.gradientEnd) {
    const angleRad = ((layer.gradientAngle ?? 90) * Math.PI) / 180;
    const x1 = (-Math.cos(angleRad) * width) / 2;
    const y1 = (-Math.sin(angleRad) * height) / 2;
    const x2 = (Math.cos(angleRad) * width) / 2;
    const y2 = (Math.sin(angleRad) * height) / 2;

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, layer.fillColor || "transparent");
    grad.addColorStop(1, layer.gradientEnd);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = layer.fillColor || "#3b82f6";
  }

  ctx.beginPath();
  switch (layer.shapeType) {
    case "circle":
      ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      break;
    case "pill":
    case "badge":
      roundRectPath(ctx, -width / 2, -height / 2, width, height, height / 2);
      break;
    case "gradient-overlay":
    case "rectangle":
    default:
      if (layer.borderRadius && layer.borderRadius > 0) {
        roundRectPath(ctx, -width / 2, -height / 2, width, height, layer.borderRadius);
      } else {
        ctx.rect(-width / 2, -height / 2, width, height);
      }
      break;
  }
  ctx.fill();

  // Borde
  if (layer.borderWidth && layer.borderWidth > 0 && layer.borderColor) {
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = layer.borderColor;
    ctx.lineWidth = layer.borderWidth;
    ctx.stroke();
  }

  ctx.restore();
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  const { x, y, width, height, rotation = 0, text = "" } = layer;
  if (!text) return;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);

  // Formato del texto
  let displayText = text;
  if (layer.textTransform === "uppercase") displayText = text.toUpperCase();
  else if (layer.textTransform === "lowercase") displayText = text.toLowerCase();
  else if (layer.textTransform === "capitalize") {
    displayText = text.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const lines = displayText.split("\n");
  const fontSize = layer.fontSize || 48;
  const fontWeight = layer.fontWeight || 700;
  const fontStyle = layer.fontStyle || "normal";
  const fontFamily = layer.fontFamily || "Montserrat, sans-serif";
  const lineHeight = fontSize * (layer.lineHeight || 1.15);

  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}", system-ui, sans-serif`;
  ctx.textAlign = layer.textAlign || "center";
  ctx.textBaseline = "middle";

  if (typeof (ctx as any).letterSpacing !== "undefined") {
    (ctx as any).letterSpacing = `${layer.letterSpacing || 0}px`;
  }

  const totalTextHeight = lines.length * lineHeight;
  const startY = -totalTextHeight / 2 + lineHeight / 2;

  // Dibujar Caja de Fondo (Pill / Box Background) si está activa
  if (layer.boxBackground && layer.boxBackground.enabled) {
    const padX = layer.boxBackground.paddingX || 24;
    const padY = layer.boxBackground.paddingY || 12;
    const boxRadius = layer.boxBackground.borderRadius || 12;

    // Calcular ancho máximo de líneas
    let maxLineWidth = 0;
    for (const line of lines) {
      const metric = ctx.measureText(line);
      if (metric.width > maxLineWidth) maxLineWidth = metric.width;
    }

    const boxW = maxLineWidth + padX * 2;
    const boxH = totalTextHeight + padY * 2;

    ctx.save();
    ctx.globalAlpha = (layer.opacity ?? 1) * (layer.boxBackground.opacity ?? 0.9);
    ctx.fillStyle = layer.boxBackground.color || "rgba(0,0,0,0.7)";
    ctx.beginPath();
    roundRectPath(ctx, -boxW / 2, -boxH / 2, boxW, boxH, boxRadius);
    ctx.fill();
    ctx.restore();
  }

  // Configurar Sombras o Glow
  if (layer.glow && layer.glowColor) {
    ctx.shadowColor = layer.glowColor;
    ctx.shadowBlur = layer.shadowBlur || 25;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (layer.shadowBlur && layer.shadowBlur > 0) {
    ctx.shadowColor = layer.shadowColor || "rgba(0,0,0,0.75)";
    ctx.shadowBlur = layer.shadowBlur;
    ctx.shadowOffsetX = layer.shadowOffsetX || 0;
    ctx.shadowOffsetY = layer.shadowOffsetY || 4;
  }

  // Relleno: Gradiente o Color sólido
  let fillStyle: string | CanvasGradient = layer.color || "#ffffff";
  if (layer.gradient && layer.gradient.enabled && layer.gradient.endColor) {
    const angleRad = ((layer.gradient.angle ?? 90) * Math.PI) / 180;
    const x1 = (-Math.cos(angleRad) * width) / 2;
    const y1 = (-Math.sin(angleRad) * height) / 2;
    const x2 = (Math.cos(angleRad) * width) / 2;
    const y2 = (Math.sin(angleRad) * height) / 2;

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, layer.gradient.startColor || layer.color || "#ffffff");
    grad.addColorStop(1, layer.gradient.endColor);
    fillStyle = grad;
  }
  ctx.fillStyle = fillStyle;

  // Dibujar cada línea
  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;
    let lineX = 0;
    if (layer.textAlign === "left") lineX = -width / 2;
    else if (layer.textAlign === "right") lineX = width / 2;

    // Trazo exterior (Stroke / Outline)
    if (layer.strokeWidth && layer.strokeWidth > 0 && layer.strokeColor) {
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineWidth = layer.strokeWidth;
      ctx.lineJoin = "round";
      ctx.strokeText(line, lineX, lineY);
    }

    // Relleno del texto
    ctx.fillText(line, lineX, lineY);
  });

  ctx.restore();
}

async function drawBrandLogoLayer(
  ctx: CanvasRenderingContext2D,
  layer: BrandLogoLayer,
  brandLogosMap?: Record<string, string>
) {
  const { x, y, width, height, rotation = 0 } = layer;

  let src = layer.customDataUrl || "";
  if (!src && brandLogosMap && layer.brandId) {
    const rawLogo = brandLogosMap[layer.brandId] || "";
    if (rawLogo) src = getSvgDataUrl(rawLogo);
  }

  if (!src) {
    // Dibujar badge elegante de fallback para que la capa sea visible y manipulable
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    if (rotation) ctx.rotate((rotation * Math.PI) / 180);

    ctx.fillStyle = "rgba(24, 24, 27, 0.85)";
    ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRectPath(ctx, -width / 2, -height / 2, width, height, Math.min(16, height / 4));
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#c084fc";
    ctx.font = `bold ${Math.max(12, Math.min(16, Math.round(height * 0.2)))}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦ LOGO DE MARCA", 0, 0);

    ctx.restore();
    return;
  }

  try {
    const img = await preloadImage(src);
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    if (rotation) ctx.rotate((rotation * Math.PI) / 180);

    // Si pide variante blanca o negra, aplicar filtro
    if (layer.variant === "white") {
      ctx.filter = "brightness(0) invert(1)";
    } else if (layer.variant === "black") {
      ctx.filter = "brightness(0)";
    }

    drawContainImage(ctx, img, -width / 2, -height / 2, width, height);
    ctx.restore();
  } catch (err) {
    console.warn("Fallo al dibujar logo de marca:", err);
  }
}

// Helpers geométricos
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, Math.min(w / 2, h / 2));
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = w / h;

  let sx = 0;
  let sy = 0;
  let sWidth = img.naturalWidth;
  let sHeight = img.naturalHeight;

  if (imgRatio > targetRatio) {
    sWidth = img.naturalHeight * targetRatio;
    sx = (img.naturalWidth - sWidth) / 2;
  } else {
    sHeight = img.naturalWidth / targetRatio;
    sy = (img.naturalHeight - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
}

function drawContainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = w / h;

  let dw = w;
  let dh = h;
  let dx = x;
  let dy = y;

  if (imgRatio > targetRatio) {
    dh = w / imgRatio;
    dy = y + (h - dh) / 2;
  } else {
    dw = h * imgRatio;
    dx = x + (w - dw) / 2;
  }

  ctx.drawImage(img, dx, dy, dw, dh);
}
