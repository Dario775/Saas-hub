import path from "node:path";
import "server-only";
import { readJson,writeJson } from "./json-store";
import { type FacebookPage,DEFAULT_PAGES } from "./pages";

export interface ServerFacebookPage extends FacebookPage {
  accessToken: string;
}
const CUSTOM_PAGES_PATH = path.join(process.cwd(), "custom-pages.json");
const HIDDEN_PAGES_PATH = path.join(process.cwd(), "hidden-pages.json");

export function publicPage(page: ServerFacebookPage): FacebookPage {
  return {
    id: page.id,
    name: page.name,
    category: page.category,
    pageId: page.pageId,
    emoji: page.emoji,
    isCustom: page.isCustom,
    connected: Boolean(page.accessToken),
    instagramAccountId: page.instagramAccountId,
    instagramUsername: page.instagramUsername,
    hasInstagram: Boolean(page.instagramAccountId),
  };
}
export function readCustomPages(): ServerFacebookPage[] {
  const pages = readJson<ServerFacebookPage[]>(CUSTOM_PAGES_PATH, []);
  if (!Array.isArray(pages))
    throw new Error("El archivo de páginas no tiene un formato válido.");
  return pages;
}
export function writeCustomPages(pages: ServerFacebookPage[]): void {
  writeJson(CUSTOM_PAGES_PATH, pages);
}
export function readHiddenPageIds(): Set<string> {
  const list = readJson<string[]>(HIDDEN_PAGES_PATH, []);
  return new Set(Array.isArray(list) ? list : []);
}
export function writeHiddenPageIds(ids: string[]): void {
  writeJson(HIDDEN_PAGES_PATH, ids);
}
export function getAllPages(): ServerFacebookPage[] {
  const custom = readCustomPages();
  const hidden = readHiddenPageIds();
  const customIds = new Set(custom.map((p) => p.id));

  const defaults = DEFAULT_PAGES
    .filter((p) => !customIds.has(p.id) && !hidden.has(p.id))
    .map((p) => ({
      ...p,
      accessToken: process.env[`FACEBOOK_TOKEN_${p.id.toUpperCase()}`] || "",
    }));

  const activeCustom = custom.filter((p) => !hidden.has(p.id));

  // Prioritize real custom pages first
  return [...activeCustom, ...defaults];
}
export function saveCustomPage(page: ServerFacebookPage): ServerFacebookPage {
  const pages = readCustomPages();
  const hidden = readJson<string[]>(HIDDEN_PAGES_PATH, []);
  if (hidden.includes(page.id)) {
    writeHiddenPageIds(hidden.filter((id) => id !== page.id));
  }
  const index = pages.findIndex(
    (p) => p.id === page.id || p.pageId === page.pageId,
  );
  const updated = { ...page, isCustom: true };
  if (index >= 0) pages[index] = updated;
  else pages.push(updated);
  writeCustomPages(pages);
  return updated;
}
export function deleteCustomPage(id: string): boolean {
  const pages = readCustomPages();
  const next = pages.filter((p) => p.id !== id && p.pageId !== id);
  const changedCustom = next.length !== pages.length;
  if (changedCustom) {
    writeCustomPages(next);
  }
  const hidden = readJson<string[]>(HIDDEN_PAGES_PATH, []);
  if (!hidden.includes(id)) {
    hidden.push(id);
    writeHiddenPageIds(hidden);
  }
  return true;
}
