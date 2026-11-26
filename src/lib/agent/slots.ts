/** Horarios de publicación según cuántas salen por día (hora local de la PC). */
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
  const perDay = Math.min(6, Math.max(1, Math.ceil(order.length / plan.days)));
  const hours = HOURS[perDay];
  const first = startOf(plan, now);
  const earliest = now.getTime() + LEAD_MS;
  const slots: Slot[] = [];
  for (let day = 0; slots.length < order.length && day < plan.days + MAX_EXTRA_DAYS; day++) {
    for (const hour of hours) {
      if (slots.length === order.length) break;
      const at = new Date(first.getFullYear(), first.getMonth(), first.getDate() + day, hour, 0, 0, 0);
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
