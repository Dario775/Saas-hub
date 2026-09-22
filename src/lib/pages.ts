// Config de páginas de Facebook
// Public metadata only. Credentials are resolved exclusively on the server.

export interface FacebookPage {
  id: string;
  name: string;
  category: string;
  pageId: string;
  connected?: boolean;
  emoji?: string;
  isCustom?: boolean;
  instagramAccountId?: string;
  instagramUsername?: string;
  hasInstagram?: boolean;
}

export const DEFAULT_PAGES: FacebookPage[] = [
  {
    id: "obsidiana",
    name: "Obsidiana",
    category: "Software / Empresa",
    pageId: "1184218568115229",
    emoji: "🔷",
  },
  {
    id: "fucsia",
    name: "Fucsia",
    category: "Agencia de Marketing",
    pageId: "1111685575364300",
    emoji: "🌸",
  },
  {
    id: "neurocortex",
    name: "NeuroCortex",
    category: "Software / Tecnología",
    pageId: "1013639518488775",
    emoji: "🧠",
  },
];

export const PAGES: FacebookPage[] = DEFAULT_PAGES;
