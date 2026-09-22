import { createHash,createHmac,timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "saashub_session";
export function sameSecret(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export function createSession(password: string, now = Date.now()): string {
  const expires = String(now + 12 * 60 * 60_000);
  return `${expires}.${createHmac("sha256", password).update(`saashub:${expires}`).digest("hex")}`;
}
export function validSession(
  value: string | undefined,
  password: string,
  now = Date.now(),
): boolean {
  if (!password || !value) return false;
  const [expires, signature] = value.split(".");
  if (
    !expires ||
    !signature ||
    !/^\d+$/.test(expires) ||
    Number(expires) <= now ||
    Number(expires) > now + 12 * 60 * 60_000
  )
    return false;
  const expected = createHmac("sha256", password)
    .update(`saashub:${expires}`)
    .digest("hex");
  return sameSecret(signature, expected);
}
