import { deleteCustomPage, getAllPages, publicPage, saveCustomPage, type ServerFacebookPage } from "@/lib/pages-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const pages = getAllPages();
    const enriched = await Promise.all(
      pages.map(async (pg) => {
        if (pg.accessToken && !pg.instagramAccountId) {
          try {
            const r = await fetch(
              `https://graph.facebook.com/v21.0/${pg.pageId}?fields=instagram_business_account{id,username,name}&access_token=${encodeURIComponent(pg.accessToken)}`,
              { signal: AbortSignal.timeout(4000) },
            );
            const data = await r.json();
            if (data?.instagram_business_account?.id) {
              pg.instagramAccountId = data.instagram_business_account.id;
              pg.instagramUsername =
                data.instagram_business_account.username ||
                data.instagram_business_account.name;
            }
          } catch {
            // Ignorar timeouts para no bloquear la respuesta
          }
        }
        return publicPage(pg);
      }),
    );
    return NextResponse.json({ success: true, pages: enriched });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, emoji, pageId, accessToken, testConnection = true } = body;

    if (!accessToken?.trim()) {
      return NextResponse.json(
        { success: false, error: "El Token de Acceso (Page Access Token) es obligatorio." },
        { status: 400 }
      );
    }

    const cleanToken = accessToken.trim();
    let finalName = name?.trim() || "";
    let finalPageId = pageId?.trim() || "";
    let finalCategory = category?.trim() || "";
    const cleanEmoji = emoji?.trim() || "📄";

    // Validar token y resolver el Page ID canónico directamente contra Facebook Graph API
    if (testConnection || !finalPageId || !finalName) {
      try {
        const ctl = new AbortController();
        const timeout = setTimeout(() => ctl.abort(), 8000);
        
        // 1. Verificar el token con /me (si es Page Access Token, devuelve el ID canónico de la página)
        const meRes = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name,category&access_token=${encodeURIComponent(cleanToken)}`,
          { signal: ctl.signal }
        );
        clearTimeout(timeout);

        const meData = await meRes.json();
        if (meRes.ok && meData?.id) {
          if (finalPageId && finalPageId !== meData.id) {
            console.log(`[Pages API] Auto-corrigiendo Page ID de '${finalPageId}' al ID canónico de Graph API: '${meData.id}'`);
          }
          finalPageId = meData.id;
          if (!finalName && meData.name) finalName = meData.name;
          if (!finalCategory && meData.category) finalCategory = meData.category;
        } else if (finalPageId) {
          // 2. Si /me no responde con id, verificar con el finalPageId directamente
          const fbRes = await fetch(
            `https://graph.facebook.com/v21.0/${finalPageId}?fields=name,category&access_token=${encodeURIComponent(cleanToken)}`
          );
          const fbData = await fbRes.json();
          if (!fbRes.ok) {
            const errMsg = fbData?.error?.message || "Token o Page ID inválido según Facebook Graph API.";
            return NextResponse.json(
              { success: false, error: `Facebook Graph API rechazó la credencial: ${errMsg}`, fbError: fbData?.error },
              { status: 400 }
            );
          }
          if (!finalName && fbData.name) finalName = fbData.name;
          if (!finalCategory && fbData.category) finalCategory = fbData.category;
        } else {
          return NextResponse.json(
            { success: false, error: meData?.error?.message || "No se pudo validar el Token con Facebook Graph API." },
            { status: 400 }
          );
        }
      } catch (e: any) {
        if (e.name === "AbortError") {
          return NextResponse.json(
            { success: false, error: "Timeout de red: Facebook Graph API no respondió a tiempo." },
            { status: 408 }
          );
        }
        console.warn("[Pages API] Error de red validando con FB:", e);
      }
    }

    if (!finalName) finalName = "Página de Facebook";
    if (!finalCategory) finalCategory = "Página de Facebook";
    if (!finalPageId) {
      return NextResponse.json(
        { success: false, error: "No se pudo determinar el Facebook Page ID. Asegúrate de que el Token sea un Page Access Token válido." },
        { status: 400 }
      );
    }

    // Detectar Instagram Business Account vinculado si existe
    let instagramAccountId = body.instagramAccountId?.trim() || undefined;
    let instagramUsername = body.instagramUsername?.trim() || undefined;
    try {
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${finalPageId}?fields=instagram_business_account{id,username,name}&access_token=${encodeURIComponent(cleanToken)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      const igData = await igRes.json();
      if (igData?.instagram_business_account?.id) {
        instagramAccountId = igData.instagram_business_account.id;
        instagramUsername =
          igData.instagram_business_account.username ||
          igData.instagram_business_account.name;
      }
    } catch (igErr) {
      console.warn("[Pages API] No se pudo consultar Instagram vinculado:", igErr);
    }

    // Generar slug único
    const baseSlug = finalName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pagina";

    const uniqueId = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    const newPage: ServerFacebookPage = {
      id: uniqueId,
      name: finalName,
      category: finalCategory,
      pageId: finalPageId,
      accessToken: cleanToken,
      emoji: cleanEmoji,
      isCustom: true,
      instagramAccountId,
      instagramUsername,
    };

    const saved = saveCustomPage(newPage);
    return NextResponse.json({
      success: true,
      page: publicPage(saved),
      message: `Página "${saved.name}" conectada exitosamente.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Error interno al guardar la página: " + err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Falta el parámetro id" }, { status: 400 });
    }

    const deleted = deleteCustomPage(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "No se pudo eliminar la página solicitada." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Página eliminada correctamente.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Error al eliminar página: " + err.message },
      { status: 500 }
    );
  }
}
