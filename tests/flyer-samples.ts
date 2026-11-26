import type { FlyerConcept, FlyerTone } from "../src/lib/flyers/types";

function sample(template: string, tone: FlyerTone, slots: FlyerConcept["slots"], assetPrompt?: string): FlyerConcept {
  return { template, tone, idea: "idea", slots, caption: "texto", ...(assetPrompt ? { assetPrompt } : {}) };
}

/** Un contenido realista por sistema de diseño. */
export const FLYER_SAMPLES: FlyerConcept[] = [
  sample("planilla", "claro", {
    archivo: "stock_FINAL_v7 (2) — copia.xlsx",
    formula: '=SI(ESERROR(BUSCARV(B7;Hoja3!A:F;4;0));"preguntar a Marta"',
    columnas: ["Producto", "Stock", "Última carga", "Responsable", "Estado"],
    filas: [
      ["Cable UTP", "#¡REF!", "¿lunes?", "Marta", "revisar"],
      ["Tablero", "12", "03/09", "#N/D", ""],
      ["Tablero (2)", "9", "—", "Marta / Diego", "¿cuál va?"],
    ],
    total: ["TOTAL", "#¡VALOR!", "", "avisar a Diego", "NO TOCAR"],
    hojas: ["Ventas", "Stock", "Stock (copia)", "Stock BUENO", "NO TOCAR"],
    titular: "Esto no es un sistema. Es Marta.",
    cierre: "Integramos tus datos en un solo sistema,",
    cierreAcento: "hecho a tu medida.",
  }),
  sample("chat", "claro", {
    etiqueta: "Control de stock",
    mensajes: [
      ["Cliente", "Hola, ¿tenés 40 unidades para mañana?", "18:02"],
      ["yo", "Sí, en el sistema figuran.", "18:03"],
      ["Depósito", "Quedan 6. Lo del sistema es de marzo.", "18:41"],
      ["yo", "Ya le dije que sí.", "18:42"],
    ],
    titular: "El stock lo sabe el depósito. El sistema, no.",
    cuerpo: "Conectamos depósito, ventas y facturación para que todos vean lo mismo.",
  }),
  sample("red", "claro", {
    etiqueta: "Integración de sistemas",
    titular: "Todo llega a un lugar.",
    nodos: ["Ventas", "Stock", "Compras", "Cobros", "Planta"],
    centro: "Vos",
    cuerpo: "Conectamos las áreas de tu empresa para que decidas con un solo dato.",
  }),
  sample("ventana", "acento", {
    etiqueta: "Landing pages",
    titular: "Una página. Un objetivo: que te escriban.",
    sitio: "Panadería Alma",
    sitioTitular: "Pan de masa madre, horneado hoy.",
    sitioBoton: "Hacé tu pedido",
    sitioItems: ["Panes", "Viandas", "Eventos"],
    cuerpo: "Diseñamos páginas claras que convierten visitas en consultas.",
  }),
  sample("afirmacion", "oscuro", {
    etiqueta: "Automatización",
    linea: "Si lo hacés todos los días igual,",
    destacado: "no lo hagas vos.",
    cuerpo: "Automatizamos las tareas repetitivas de tu operación.",
  }),
  sample("comparativa", "claro", {
    titular: "Mismo equipo, otra semana.",
    antes: "Hoy",
    antesItems: ["Cargar el pedido tres veces", "Buscar el remito", "Cerrar caja a mano", "Llamar al depósito"],
    despues: "Integrado",
    despuesItems: ["Cargarlo una vez", "Verlo en el pedido", "Caja que cierra sola", "Stock a la vista"],
    cuerpo: "Unimos los sistemas que tu empresa ya usa.",
  }),
  sample("pasos", "oscuro", {
    etiqueta: "Para guardar",
    titular: "Tres señales de que tu planilla no da más",
    pasos: ["Hay una sola persona que la entiende.", "Existe más de una versión final.", "Nadie se anima a borrar una columna."],
    cuerpo: "Si te pasa una, hablemos antes de que te pasen las tres.",
  }),
  sample("oferta", "oscuro", {
    sobre: "En landing pages",
    numero: "10%",
    detalle: "de descuento",
    condicion: "Durante noviembre",
    cuerpo: "Una página clara y profesional para presentar tu propuesta.",
  }),
  sample("foto", "oscuro", { etiqueta: "Hardware a medida", linea: "Si no existe,", destacado: "lo hacemos.", cuerpo: "Diseñamos el hardware y el software que tu operación necesita." }, "tweezers placing a chip"),
  sample("objeto", "acento", { etiqueta: "Software + hardware", palabra1: "A tu", palabra2: "medida", cuerpo: "Tu empresa no es estándar. Tu tecnología tampoco." }, "a rugged controller"),
];
