import { SESSION_COOKIE,validSession } from "@/lib/auth";
import { NextRequest,NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const api = pathname.startsWith("/api/");
  if (api && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const expected = process.env.PUBLIC_APP_URL
      ? new URL(process.env.PUBLIC_APP_URL).origin
      // NextURL normalizes loopback addresses to localhost. Compare against the
      // actual request host so a same-origin request from 127.0.0.1 still works.
      : new URL(
          `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`,
        ).origin;
    if (
      (origin && origin !== expected) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return NextResponse.json(
        { error: "Origen de la solicitud no permitido." },
        { status: 403 },
      );
    if (Number(request.headers.get("content-length") || 0) > 20_000_000)
      return NextResponse.json(
        { error: "La solicitud supera el límite de 20 MB." },
        { status: 413 },
      );
  }
  const password = process.env.HUB_PASSWORD;
  const publicRoute =
    pathname === "/login" ||
    pathname.startsWith("/demo/") ||
    pathname === "/api/session";
  if (
    password &&
    !publicRoute &&
    !validSession(request.cookies.get(SESSION_COOKIE)?.value, password)
  ) {
    if (api)
      return NextResponse.json(
        { error: "Tu sesión terminó. Ingresá de nuevo al panel." },
        { status: 401 },
      );
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const response = NextResponse.next();
  if (api) response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico|mp4|woff2)$).*)",
  ],
};
