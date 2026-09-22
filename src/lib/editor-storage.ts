import type { AspectRatioId,CanvasLayer } from "@/components/composer/types";
export interface EditorDraft {
  layers: CanvasLayer[];
  aspectRatio: AspectRatioId;
  customDimensions?: { width: number; height: number };
  updatedAt: string;
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("saashub-designs", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readEditorDraft(
  id: string,
): Promise<EditorDraft | undefined> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction("drafts", "readonly")
        .objectStore("drafts")
        .get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
export async function saveEditorDraft(
  id: string,
  draft: EditorDraft,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("drafts", "readwrite");
      transaction.objectStore("drafts").put(draft, id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
