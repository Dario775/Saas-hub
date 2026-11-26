import fs from "fs";
import path from "path";
import { readJson,withFileLock,writeJson } from "./json-store";
import { leadIdentity } from "./lead-identity";
import type { LeadEvidence } from "./lead-evidence";
import type { BusinessDossier, OpportunitySummary } from "./opportunity-types";

export type LeadStatus = "nuevo" | "contactado" | "respondio" | "demo" | "cliente" | "descartado";

export interface LeadItem {
  place_id: string;
  nombre: string;
  rubro: string;
  zona: string;
  direccion?: string;
  telefono?: string;
  website?: string;
  email?: string;
  /**
   * Puntuación pública real cuando la fuente la provee (Google Places).
   * OpenStreetMap no la expone: en ese caso queda sin definir y nunca se estima.
   */
  rating?: number | string;
  types?: string;
  status: LeadStatus;
  notes?: string;
  lastContactedAt?: string;
  customPitch?: string;
  whatsappLink?: string;
  batch?: string;
  searchDate?: string;
  /** Identidad estable del comercio, independiente del id de la fuente. */
  identity?: string;
  /** Evidencias: de dónde salió cada dato y con qué estado. */
  evidence?: LeadEvidence[];
  /** Resumen del último análisis de oportunidad (sin el detalle completo). */
  opportunity?: OpportunitySummary | null;
  /** Dossier del descubrimiento digital; se reutiliza mientras siga fresco. */
  dossier?: BusinessDossier | null;
}

export interface LeadCrmData {
  status: LeadStatus;
  notes?: string;
  customPitch?: string;
  lastContactedAt?: string;
}

/** Configuración de la campaña activa (marca, propuesta, tono y plantilla de mensaje). */
export interface CampaignConfig {
  name?: string;
  brandName?: string;
  valueProposition?: string;
  voiceTone?: string;
  messageTemplate?: string;
  updatedAt?: string;
}

export const DEFAULT_CAMPAIGN = {
  brandName: "NeuroCortex",
  valueProposition: "",
  voiceTone: "profesional y cercano",
  messageTemplate: "",
};

export const DEFAULT_MESSAGE_TEMPLATE =
  "Hola 👋 Vi {negocio} ({rubro}) en {zona} y quería mostrarle algo que le va a servir para vender más y automatizar sus operaciones con {marca}{propuesta}. ¿Tiene 5 minutos para una demo rápida sin compromiso?";

const DATA_DIR = path.join(process.cwd(), "leads", "data");
const LEADS_JSON_PATH = path.join(DATA_DIR, "leads.json");
const LEADS_CSV_PATH = path.join(DATA_DIR, "leads.csv");
const CRM_DB_PATH = path.join(process.cwd(), "leads-crm.json");
const CAMPAIGN_CONFIG_PATH = path.join(process.cwd(), "campaign-config.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Lee la campaña activa desde campaign-config.json (vacía si no existe). */
export function getCampaignConfig(): CampaignConfig {
  try {
    if (fs.existsSync(CAMPAIGN_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CAMPAIGN_CONFIG_PATH, "utf8"));
      if (raw && typeof raw === "object") {
        const cfg: CampaignConfig = {};
        if (typeof raw.name === "string") cfg.name = raw.name;
        if (typeof raw.brandName === "string") cfg.brandName = raw.brandName;
        if (typeof raw.valueProposition === "string") cfg.valueProposition = raw.valueProposition;
        if (typeof raw.voiceTone === "string") cfg.voiceTone = raw.voiceTone;
        if (typeof raw.messageTemplate === "string") cfg.messageTemplate = raw.messageTemplate;
        if (typeof raw.updatedAt === "string") cfg.updatedAt = raw.updatedAt;
        return cfg;
      }
    }
  } catch (err) {
    console.error("Error al leer campaign-config.json:", err);
  }
  return {};
}

/** Persiste la campaña activa (solo campos conocidos). */
export function saveCampaignConfig(cfg: CampaignConfig): void {
  try {
    const clean: CampaignConfig = {};
    if (cfg.name) clean.name = cfg.name;
    if (cfg.brandName) clean.brandName = cfg.brandName;
    if (cfg.valueProposition) clean.valueProposition = cfg.valueProposition;
    if (cfg.voiceTone) clean.voiceTone = cfg.voiceTone;
    if (cfg.messageTemplate) clean.messageTemplate = cfg.messageTemplate;
    if (cfg.updatedAt) clean.updatedAt = cfg.updatedAt;
    fs.writeFileSync(CAMPAIGN_CONFIG_PATH, JSON.stringify(clean, null, 2), "utf8");
  } catch (err) {
    console.error("Error al escribir campaign-config.json:", err);
  }
}

/** Resuelve la marca efectiva: argumento > campaña activa > valor por defecto. */
export function resolveCampaignBrand(brandName?: string, cfg?: CampaignConfig): string {
  if (brandName) return brandName;
  return cfg?.brandName || DEFAULT_CAMPAIGN.brandName;
}

/** Rellena una plantilla con tokens {marca},{negocio},{rubro},{zona},{propuesta}. */
export function fillCampaignTemplate(
  template: string,
  lead: { nombre: string; rubro: string; zona: string },
  cfg: CampaignConfig
): string {
  const brand = resolveCampaignBrand(undefined, cfg);
  const propuesta = cfg.valueProposition ? ` (${cfg.valueProposition.trim()})` : "";
  const msg = (template || DEFAULT_MESSAGE_TEMPLATE)
    .replace(/\{marca\}/g, brand)
    .replace(/\{negocio\}/g, lead.nombre || "su negocio")
    .replace(/\{rubro\}/g, lead.rubro || "comercio")
    .replace(/\{zona\}/g, lead.zona || "la zona")
    .replace(/\{propuesta\}/g, propuesta)
    .replace(/\{\w+\}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
  return msg;
}

export function readCrmDb(): Record<string, LeadCrmData> { return readJson(CRM_DB_PATH, {}); }
export function writeCrmDb(data: Record<string, LeadCrmData>): void { writeJson(CRM_DB_PATH, data); }

export function getLeadKey(lead: Partial<LeadItem>): string {
  return lead.place_id || `${lead.nombre || ""}_${lead.zona || ""}`.toLowerCase().replace(/\s+/g, "_");
}

export function formatWaDigits(tel?: string): string {
  if (!tel) return "";
  let digits = tel.replace(/[^\d]/g, "");
  // Si es número argentino local (ej. 11 1234 5678), ayuda agregando código país si no lo tiene
  if (digits.length === 10 && (digits.startsWith("11") || digits.startsWith("15") || digits.startsWith("2") || digits.startsWith("3"))) {
    digits = "549" + digits;
  }
  return digits;
}

export function buildDefaultWaMessage(
  lead: { nombre: string; rubro: string; zona: string },
  brandName?: string,
  cfg?: CampaignConfig
): string {
  const c = cfg || getCampaignConfig();
  const template = c.messageTemplate || DEFAULT_MESSAGE_TEMPLATE;
  const msg = fillCampaignTemplate(template, lead, { ...c, brandName: resolveCampaignBrand(brandName, c) });
  return msg;
}

export function buildWhatsAppLink(
  lead: { telefono?: string; nombre: string; rubro: string; zona: string; customPitch?: string },
  brandName?: string
): string {
  const digits = formatWaDigits(lead.telefono);
  if (!digits) return "";
  const cfg = getCampaignConfig();
  const msg = lead.customPitch || buildDefaultWaMessage(lead, brandName, cfg);
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

export function getLeads(): LeadItem[] {
  ensureDir();
  const crm = readCrmDb();
  let rawLeads: any[] = [];

  if (fs.existsSync(LEADS_JSON_PATH)) {
    rawLeads = readJson(LEADS_JSON_PATH, []);
    if (!Array.isArray(rawLeads)) throw new Error("El archivo de prospectos no tiene un formato válido.");
  } else if (fs.existsSync(LEADS_CSV_PATH)) {
    try {
      const content = fs.readFileSync(LEADS_CSV_PATH, "utf8").replace(/^\ufeff/, "").trim();
      const [header, ...rows] = content.split("\n");
      const cols = header.split(",").map((c) => c.replace(/"/g, "").trim());
      rawLeads = rows.map((r) => {
        const item: any = {};
        const values = r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        cols.forEach((col, idx) => {
          item[col] = (values[idx] || "").replace(/^"|"$/g, "").replace(/""/g, '"');
        });
        return item;
      });
    } catch (e) {
      console.error("Error al leer leads.csv:", e);
    }
  }

  return rawLeads.map((l: any, idx: number) => {
    const key = l.place_id || `lead_${idx}_${l.nombre || ""}`;
    const crmEntry = crm[key] || {};
    const leadItem: LeadItem = {
      place_id: l.place_id || key,
      nombre: l.nombre || "",
      rubro: l.rubro || "",
      zona: l.zona || "",
      direccion: l.direccion || "",
      telefono: l.telefono || "",
      website: l.website || "",
      email: l.email || "",
      rating: l.rating || undefined,
      types: l.types || "",
      status: l.status || crmEntry.status || "nuevo",
      notes: l.notes ?? crmEntry.notes ?? "",
      lastContactedAt: l.lastContactedAt || crmEntry.lastContactedAt || undefined,
      customPitch: l.customPitch || crmEntry.customPitch || undefined,
      batch: l.batch,
      searchDate: l.searchDate,
      identity:
        l.identity ||
        leadIdentity({
          nombre: l.nombre,
          direccion: l.direccion,
          zona: l.zona,
        }),
      evidence: Array.isArray(l.evidence) ? l.evidence : undefined,
      opportunity: l.opportunity ?? null,
      dossier: l.dossier ?? null,
    };
    leadItem.whatsappLink = buildWhatsAppLink(leadItem);
    return leadItem;
  });
}

export function saveLeads(leads: LeadItem[]): void {
  ensureDir();
  const crm = readCrmDb();

  // Actualizar leads-crm.json con estados
  for (const l of leads) {
    const key = getLeadKey(l);
    crm[key] = {
      status: l.status || "nuevo",
      notes: l.notes || "",
      customPitch: l.customPitch || undefined,
      lastContactedAt: l.lastContactedAt || undefined,
    };
  }
  writeCrmDb(crm);

  // Guardar leads.json
  const rawList = leads.map((l) => ({
    nombre: l.nombre,
    rubro: l.rubro,
    zona: l.zona,
    direccion: l.direccion || "",
    telefono: l.telefono || "",
    website: l.website || "",
    email: l.email || "",
    rating: l.rating || "",
    types: l.types || "",
    place_id: l.place_id,
    batch: l.batch, searchDate: l.searchDate, status: l.status, notes: l.notes,
    customPitch: l.customPitch, lastContactedAt: l.lastContactedAt,
    identity: l.identity, evidence: l.evidence, opportunity: l.opportunity,
    dossier: l.dossier,
  }));
  writeJson(LEADS_JSON_PATH, rawList);

  // Guardar leads.csv para mantener 100% interoperabilidad con scripts en leads/
  const csvHeader = "nombre,rubro,zona,direccion,telefono,website,email,rating,types";
  const csvRows = rawList.map((l) =>
    [l.nombre, l.rubro, l.zona, l.direccion, l.telefono, l.website, l.email, l.rating, l.types]
      .map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  fs.writeFileSync(LEADS_CSV_PATH, "\ufeff" + [csvHeader, ...csvRows].join("\n"), "utf8");
}

/**
 * Mutación serializada de la lista de prospectos: usa el bloqueo del proyecto
 * para que dos operaciones simultáneas no se pisen.
 */
export async function mutateLeads<T>(
  mutate: (leads: LeadItem[]) => T,
): Promise<T> {
  ensureDir();
  return withFileLock(LEADS_JSON_PATH, async () => {
    const leads = getLeads();
    const result = mutate(leads);
    saveLeads(leads);
    return result;
  });
}

export function updateLeadStatus(placeId: string, status: LeadStatus, notes?: string, customPitch?: string): LeadItem | null {
  if (!["nuevo", "contactado", "respondio", "demo", "cliente", "descartado"].includes(status)) throw new Error("Estado del prospecto inválido.");
  const leads = getLeads();
  const target = leads.find((l) => l.place_id === placeId);
  if (!target) return null;

  target.status = status;
  if (notes !== undefined) target.notes = notes;
  if (customPitch !== undefined) target.customPitch = customPitch;
  if (status === "contactado") {
    target.lastContactedAt = new Date().toISOString();
  }
  target.whatsappLink = buildWhatsAppLink(target);

  saveLeads(leads);
  return target;
}

export function calculateStats(leads: LeadItem[]) {
  const total = leads.length;
  const conTelefono = leads.filter((l) => !!l.telefono).length;
  const conEmail = leads.filter((l) => !!l.email).length;
  const conWebsite = leads.filter((l) => !!l.website).length;

  const porEstado: Record<LeadStatus, number> = {
    nuevo: 0,
    contactado: 0,
    respondio: 0,
    demo: 0,
    cliente: 0,
    descartado: 0,
  };

  for (const l of leads) {
    if (porEstado[l.status] !== undefined) {
      porEstado[l.status]++;
    } else {
      porEstado.nuevo++;
    }
  }

  return {
    total,
    conTelefono,
    conEmail,
    conWebsite,
    porEstado,
  };
}

export const DEMO_LEADS: LeadItem[] = [
  {
    place_id: "demo_1",
    nombre: "Ferretería El Progreso",
    rubro: "ferretería",
    zona: "Palermo, Buenos Aires",
    direccion: "Av. Santa Fe 3420, CABA",
    telefono: "+54 11 4821-9988",
    website: "https://ferreteriaelprogreso.com.ar",
    email: "ventas@ferreteriaelprogreso.com.ar",
    rating: 4.6,
    types: "hardware_store|point_of_interest",
    status: "nuevo",
  },
  {
    place_id: "demo_2",
    nombre: "Boutique Magnolia",
    rubro: "tienda de ropa",
    zona: "Palermo, Buenos Aires",
    direccion: "Gurruchaga 1650, CABA",
    telefono: "+54 11 5543-1200",
    website: "https://magnoliaboutique.ar",
    email: "",
    rating: 4.8,
    types: "clothing_store|store",
    status: "contactado",
    lastContactedAt: new Date(Date.now() - 86400000).toISOString(),
    notes: "Enviado WhatsApp con presentación de catálogo online.",
  },
  {
    place_id: "demo_3",
    nombre: "Almacén Don Mario",
    rubro: "almacén",
    zona: "Caballito, Buenos Aires",
    direccion: "Av. Rivadavia 5120, CABA",
    telefono: "+54 11 4902-3344",
    website: "",
    email: "",
    rating: 4.3,
    types: "grocery_or_supermarket|food",
    status: "nuevo",
  },
  {
    place_id: "demo_4",
    nombre: "Iron Fitness Club",
    rubro: "gimnasio",
    zona: "San Isidro, Buenos Aires",
    direccion: "Belgrano 410, San Isidro",
    telefono: "+54 11 4743-8822",
    website: "https://ironfitness.com.ar",
    email: "info@ironfitness.com.ar",
    rating: 4.9,
    types: "gym|health",
    status: "respondio",
    notes: "Interesados en automatizar cobranzas de cuotas y promos en Instagram.",
  },
  {
    place_id: "demo_5",
    nombre: "Carnicería Gourmet La Ternera",
    rubro: "carnicería",
    zona: "La Plata, Buenos Aires",
    direccion: "Calle 12 N° 780, La Plata",
    telefono: "+54 221 422-5566",
    website: "",
    email: "",
    rating: 4.5,
    types: "food|store",
    status: "nuevo",
  },
];
