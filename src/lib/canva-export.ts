import "server-only";
import { fetchPublic } from "./public-fetch";

/** Export the first page at the design's original dimensions. */
export async function exportCanvaImage(token: string, designId: string) {
  if (!/^[\w-]+$/.test(designId))
    throw new Error("Identificador de diseño inválido.");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const response = await fetch("https://api.canva.com/rest/v1/exports", {
    method: "POST",
    headers,
    body: JSON.stringify({
      design_id: designId,
      format: { type: "png", pages: [1] },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  let data = await response.json();
  if (!response.ok)
    throw new Error(
      data.message ||
        "Canva no pudo iniciar la exportación. Revisá los permisos de la conexión.",
    );
  const id = data.job?.id;
  if (!id)
    throw new Error("Canva no devolvió un identificador de exportación.");
  const deadline = Date.now() + 45_000;
  while (data.job?.status === "in_progress" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const status = await fetch(
      `https://api.canva.com/rest/v1/exports/${encodeURIComponent(id)}`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (!status.ok)
      throw new Error("No se pudo consultar la exportación de Canva.");
    data = await status.json();
  }
  if (data.job?.status !== "success" || !data.job.urls?.[0])
    throw new Error(
      data.job?.error?.message ||
        "Canva todavía no completó la exportación. Intentá nuevamente en unos segundos.",
    );
  const image = await fetchPublic(data.job.urls[0], 10_000_000);
  if (!image.contentType.startsWith("image/png"))
    throw new Error("Canva devolvió un formato inesperado.");
  return `data:image/png;base64,${image.body.toString("base64")}`;
}
