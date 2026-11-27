/** Máximo de publicaciones por día. */
export const MAX_PER_DAY = 6;

/** Horarios automáticos según cuántas salen por día (hora local de la PC). */
const HOURS: Record<number, number[]> = {
  1: [12],
  2: [11, 19],
  3: [10, 14, 19],
  4: [9, 12, 16, 20],
  5: [9, 12, 15, 18, 21],
  6: [9, 11, 13, 16, 19, 21],
};
/** Margen mínimo antes de la primera publicación. */
const LEAD_MS = 60 * 60_000;
const MAX_EXTRA_DAYS = 7;

export interface Slot {
  at: Date;
  media: "image" | "video";
}

export interface SlotPlan {
  images: number;
  videos: number;
  days: number;
  /** AAAA-MM-DD; si falta, mañana. */
  startDate: string | null;
  /** Horarios pedidos ("HH:MM"), los mismos cada día. Si faltan, se reparten solos. */
  times?: string[];
}

/** "9", "9:30", "21.15", "09:00 hs" → "09:30". Nulo si no es una hora válida. */
export function readTime(value: unknown): string | null {
  const match = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:h|hs|horas?)?\s*$/i.exec(String(value ?? ""));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Horarios válidos, sin repetir, ordenados y como mucho MAX_PER_DAY. */
export function readTimes(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map(readTime).filter((time): time is string => Boolean(time)))].sort().slice(0, MAX_PER_DAY);
}

function dayTimes(plan: SlotPlan, total: number): Array<[number, number]> {
  const asked = readTimes(plan.times);
  if (asked.length) return asked.map((time) => time.split(":").map(Number) as [number, number]);
  const perDay = Math.min(MAX_PER_DAY, Math.max(1, Math.ceil(total / plan.days)));
  return HOURS[perDay].map((hour) => [hour, 0]);
}

function startOf(plan: SlotPlan, now: Date): Date {
  if (plan.startDate) {
    const [year, month, day] = plan.startDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** Reparte los videos parejo entre las imágenes, sin amontonarlos. */
function mediaOrder(images: number, videos: number): Array<Slot["media"]> {
  const total = images + videos;
  return Array.from({ length: total }, (_, index) =>
    Math.floor(((index + 1) * videos) / total) > Math.floor((index * videos) / total) ? "video" : "image",
  );
}

/**
 * Asigna fecha y hora a cada pieza. Si el primer día ya está avanzado, los
 * horarios que no llegan pasan a los días siguientes.
 */
export function planSlots(plan: SlotPlan, now = new Date()): Slot[] {
  const order = mediaOrder(plan.images, plan.videos);
  const times = dayTimes(plan, order.length);
  const first = startOf(plan, now);
  const earliest = now.getTime() + LEAD_MS;
  const slots: Slot[] = [];
  for (let day = 0; slots.length < order.length && day < plan.days + MAX_EXTRA_DAYS; day++) {
    for (const [hour, minute] of times) {
      if (slots.length === order.length) break;
      const at = new Date(first.getFullYear(), first.getMonth(), first.getDate() + day, hour, minute, 0, 0);
      if (at.getTime() < earliest) continue;
      slots.push({ at, media: order[slots.length] });
    }
  }
  return slots;
}

const DAY_NAMES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "lun 1/12 09:00" */
export function formatSlot(at: Date): string {
  const time = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return `${DAY_NAMES[at.getDay()]} ${at.getDate()}/${at.getMonth() + 1} ${time}`;
}
