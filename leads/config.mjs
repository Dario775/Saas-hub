// ============================================================
// CONFIG — Prospección Obsidiana (Google Maps → WhatsApp/Email)
// Edite RUBROS, ZONAS, mensajes y oferta a gusto.
// ============================================================

// Rubros a buscar (ajuste al mercado objetivo)
export const RUBROS = [
  "ferretería",
  "tienda de ropa",
  "almacén",
  "kiosco",
  "perfumería",
  "carnicería",
];

// Zonas objetivo (ejemplos; reemplace por las suyas)
export const ZONAS = [
  "Palermo, Buenos Aires",
  "Caballito, Buenos Aires",
  "San Isidro, Buenos Aires",
  "La Plata, Buenos Aires",
];

// Límite de resultados por búsqueda (máx 20 por llamada Places)
export const MAX_POR_BUSQUEDA = 20;

// ============================================================
// MENSAJES (placeholders: {negocio}, {rubro}, {zona})
// ============================================================

export const WA_MENSAJE = `Hola 👋 Vi {negocio} ({rubro}) en {zona} y quería mostrarle algo que le va a servir.

¿Sigue facturando a mano y cuadrando la caja con planillas? Obsidiana lo hace solo: POS ultra veloz + facturación electrónica ARCA (A, B y C) + stock sincronizado, y si quiere, tienda online en el día.

Le dejo 10 minutos de demo sin compromiso — alta gratis y 30 días de garantía. ¿Le parece?`;

export const EMAIL_ASUNTO = `{negocio}: dejá de cuadrar la caja a mano (oferta por tiempo limitado)`;

export const EMAIL_CUERPO = `Hola {negocio} 👋

Le escribo porque vi su comercio ({rubro}) en {zona} y sé que la facturación electrónica y el control de caja son un dolor todos los días.

Obsidiana es la plataforma que usan comercios como el suyo para:
• POS ultra veloz + facturación ARCA automática (A, B y C)
• Stock sincronizado entre local, web y WhatsApp
• Control de caja diario con arqueos y cierres de lote
• Tienda online lista en el día

OFERTA DE LANZAMIENTO (válida esta semana):
✅ Alta e implementación SIN CARGO
✅ 30 días de garantía
✅ Plan anual con 20% de descuento (pago adelantado)

👉 Agende su demo de 10 minutos: https://obsidiana.com.ar
Si no le interesa, solo responda "BAJA" y no vuelvo a escribirle.

Saludos,
Obsidiana`;

export const OFERTA = "Alta gratis + 30 días de garantía + 20% off anual";

// Carpeta de datos de salida
export const DATA_DIR = new URL("./data/", import.meta.url).pathname;
