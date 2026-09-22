import { NextRequest, NextResponse } from "next/server";
import { getAllPages } from "./pages-server";
import { decodeImage, validatePlatforms } from "./publish-validation";
import { dispatchToSocialNetworks } from "./social-dispatcher";

export async function handlePublish(
  request: NextRequest,
  media: "text" | "image" | "video",
) {
  try {
    const body = await request.json();
    validatePlatforms(body.platforms);
    const page = getAllPages().find((page) => page.id === body.pageId);
    if (!page?.accessToken)
      return NextResponse.json(
        { error: "Conectá una página de Facebook/Meta antes de publicar." },
        { status: 400 },
      );
    if (
      typeof body.message !== "string" ||
      body.message.length > 60_000 ||
      (media === "text" && !body.message.trim())
    )
      return NextResponse.json(
        { error: "Escribí un mensaje válido." },
        { status: 400 },
      );
    if (media === "video" && typeof body.videoUrl !== "string")
      return NextResponse.json(
        { error: "Seleccioná un video." },
        { status: 400 },
      );

    const platforms =
      Array.isArray(body.platforms) && body.platforms.length > 0
        ? body.platforms
        : ["facebook"];

    const dispatch = await dispatchToSocialNetworks(
      page,
      {
        message: body.message,
        image: media === "image" ? decodeImage(body.image) : undefined,
        videoPath: media === "video" ? body.videoUrl : undefined,
      },
      platforms,
    );

    if (!dispatch.hasSuccess) {
      return NextResponse.json(
        {
          error:
            dispatch.errors.join(" | ") ||
            "No se pudo confirmar la publicación en las redes seleccionadas.",
          platformResults: dispatch.platformResults,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      page: page.name,
      postId: dispatch.primaryId,
      videoId: media === "video" ? dispatch.primaryId : undefined,
      permalink: dispatch.primaryPermalink,
      platformResults: dispatch.platformResults,
      partialErrors: dispatch.allSucceeded ? undefined : dispatch.errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo confirmar la publicación.",
        hint: "Revisá el estado de la conexión antes de volver a enviar.",
      },
      { status: 502 },
    );
  }
}
