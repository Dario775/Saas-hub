import { NextRequest,NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token?.trim()) {
      return NextResponse.json(
        { success: false, error: "El Token de Acceso es requerido." },
        { status: 400 }
      );
    }

    const cleanToken = token.trim();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);

    // 1. Consultar /me
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,category,picture&access_token=${encodeURIComponent(cleanToken)}`,
      { signal: ctl.signal }
    );
    clearTimeout(timer);

    const meData = await meRes.json();
    if (!meRes.ok) {
      const errMsg = meData?.error?.message || "Token inválido o expirado según Facebook Graph API.";
      return NextResponse.json(
        { success: false, error: errMsg, fbError: meData?.error },
        { status: 400 }
      );
    }

    // Si tiene categoría, es un Page Access Token directo
    if (meData.category) {
      return NextResponse.json({
        success: true,
        type: "page",
        pageId: meData.id,
        name: meData.name,
        category: meData.category,
        pictureUrl: meData.picture?.data?.url || null,
      });
    }

    // 2. Si no tiene categoría, podría ser un User Token que administra páginas
    try {
      const accRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,category,access_token&access_token=${encodeURIComponent(cleanToken)}`
      );
      const accData = await accRes.json();
      if (accRes.ok && Array.isArray(accData?.data) && accData.data.length > 0) {
        return NextResponse.json({
          success: true,
          type: "user",
          userName: meData.name,
          pages: accData.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category || "Página de Facebook",
            accessToken: p.access_token,
          })),
        });
      }
    } catch {
      // Ignorar fallback
    }

    return NextResponse.json({
      success: true,
      type: "page",
      pageId: meData.id,
      name: meData.name,
      category: meData.category || "Página de Facebook",
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json(
        { success: false, error: "Tiempo de espera agotado al conectar con Facebook." },
        { status: 408 }
      );
    }
    return NextResponse.json(
      { success: false, error: err.message || "Error al inspeccionar token" },
      { status: 500 }
    );
  }
}
