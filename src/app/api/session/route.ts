import { createSession,sameSecret,SESSION_COOKIE } from "@/lib/auth";
import { NextRequest,NextResponse } from "next/server";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: NextRequest) {
  const password = process.env.HUB_PASSWORD;
  if (!password) return NextResponse.json({ success: true });
  // Single administrator: one bounded rate limit also works behind a local reverse proxy.
  const key = "admin";
  const previous = attempts.get(key);
  if (previous && previous.until > Date.now() && previous.count >= 10)
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá un minuto." },
      { status: 429 },
    );
  const limit =
    previous && previous.until > Date.now()
      ? previous
      : { count: 0, until: Date.now() + 60_000 };
  attempts.set(key, { ...limit, count: limit.count + 1 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (typeof body.password !== "string" || !sameSecret(body.password, password))
    return NextResponse.json(
      { error: "La contraseña no es correcta." },
      { status: 401 },
    );
  attempts.delete(key);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, createSession(password), {
    httpOnly: true,
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return response;
}
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
