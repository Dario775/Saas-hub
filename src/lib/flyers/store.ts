import fs from "node:fs";
import path from "node:path";
import { readJson, withFileLock, writeJson } from "../json-store";
import type { FlyerJob } from "./types";

const ROOT = path.join(process.cwd(), "flyers-data");
const INDEX = path.join(ROOT, "jobs.json");
const MAX_JOBS = 60;
/** Los identificadores arman rutas: solo los que genera el sistema. */
const SAFE_ID = /^[0-9a-f-]{36}$/;

export function assertSafeId(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error("Identificador de flyer inválido.");
  return id;
}

export function readJobs(): FlyerJob[] {
  const jobs = readJson<FlyerJob[]>(INDEX, []);
  return Array.isArray(jobs) ? jobs : [];
}

export async function mutateJobs<T>(mutate: (jobs: FlyerJob[]) => { jobs: FlyerJob[]; result: T }): Promise<T> {
  fs.mkdirSync(ROOT, { recursive: true });
  return withFileLock(INDEX, async () => {
    const { jobs, result } = mutate(readJobs());
    writeJson(INDEX, jobs.slice(0, MAX_JOBS));
    return result;
  });
}

export async function updateJob(id: string, change: (job: FlyerJob) => FlyerJob): Promise<void> {
  await mutateJobs((jobs) => ({ jobs: jobs.map((job) => (job.id === id ? change(job) : job)), result: undefined }));
}

export function flyerFile(id: string, kind: "imagen" | "recurso"): string {
  return path.join(ROOT, `${assertSafeId(id)}-${kind}.png`);
}

export function saveFlyerFile(id: string, kind: "imagen" | "recurso", data: Buffer): void {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(flyerFile(id, kind), data);
}

export function readFlyerFile(id: string, kind: "imagen" | "recurso"): Buffer | null {
  const file = flyerFile(id, kind);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}
