import path from "node:path";

/** Only application media can be read by a publishing endpoint. */
export function resolvePublicMedia(
  value: string,
  folders = ["generated-videos", "scheduled-videos", "scheduled-images"],
  root = path.join(process.cwd(), "public"),
): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\\") ||
    value.includes("\0")
  )
    throw new Error("Ruta de archivo inválida.");
  const relative = value.replace(/^\//, "");
  const folder = folders.find((folder) => relative.startsWith(`${folder}/`));
  if (!folder)
    throw new Error("El archivo no pertenece a la biblioteca de medios.");
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root, folder) + path.sep))
    throw new Error("Ruta de archivo fuera de la biblioteca.");
  return resolved;
}
