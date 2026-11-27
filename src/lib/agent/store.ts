import fs from "node:fs";
import path from "node:path";
import { readJson, withFileLock, writeJson } from "../json-store";
import type { CampaignRequest } from "./intent";

export type CampaignStatus = "generating" | "review" | "scheduling" | "scheduled" | "cancelled" | "failed";

export interface CampaignPiece {
  jobId: string;
  flyerId: string;
  media: "image" | "video";
  caption: string;
  /** Ruta pública del MP4 si es video. */
  videoUrl?: string;
  /** Publicación del calendario, una vez programada. */
  postId?: string;
  scheduledAt?: string;
  /** Último estado avisado por Telegram. */
  notified?: "published" | "failed";
}

export interface Campaign {
  id: string;
  chatId: number;
  request: CampaignRequest;
  status: CampaignStatus;
  step: string;
  createdAt: string;
  pieces: CampaignPiece[];
  error?: string;
}

/** Datos del agente: fuera de Git, como el resto de los datos del panel. */
export function agentDir(): string {
  return path.join(process.cwd(), "agent-data");
}

function campaignsFile(): string {
  fs.mkdirSync(agentDir(), { recursive: true });
  return path.join(agentDir(), "campaigns.json");
}

export function readCampaigns(): Campaign[] {
  const list = readJson<Campaign[]>(campaignsFile(), []);
  return Array.isArray(list) ? list : [];
}

export function findCampaign(id: string): Campaign | undefined {
  return readCampaigns().find((campaign) => campaign.id === id);
}

export async function saveCampaign(campaign: Campaign): Promise<void> {
  await withFileLock(campaignsFile(), async () => {
    const others = readCampaigns().filter((item) => item.id !== campaign.id);
    // Se guardan las últimas 50: alcanza para avisar y para el historial reciente.
    writeJson(campaignsFile(), [campaign, ...others].slice(0, 50));
  });
}

export async function updateCampaign(id: string, change: (campaign: Campaign) => Campaign): Promise<Campaign> {
  return withFileLock(campaignsFile(), async () => {
    const list = readCampaigns();
    const current = list.find((item) => item.id === id);
    if (!current) throw new Error("No encontramos esa campaña.");
    const next = change(current);
    writeJson(
      campaignsFile(),
      list.map((item) => (item.id === id ? next : item)),
    );
    return next;
  });
}
