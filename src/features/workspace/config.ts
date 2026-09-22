import { DEFAULT_PAGES,type FacebookPage } from "@/lib/pages";
export const INITIAL_PAGES: FacebookPage[] = DEFAULT_PAGES;

export const NAV = [
  { id: "creative", label: "Estudio Creativo", icon: "💡", color: "amber" },
  {
    id: "composer",
    label: "Compositor de Capas",
    icon: "🖼️",
    color: "emerald",
  },
  { id: "image", label: "Imagen", icon: "🎨", color: "cyan" },
  { id: "publish", label: "Publicar", icon: "📢", color: "blue" },
] as const;

export type TabId = (typeof NAV)[number]["id"] | "brandkit" | "overview";

export const BRAND_LOGOS = {
  obsidiana: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" rx="36" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
    <path d="M80 30 L125 75 L80 120 L35 75 Z" fill="url(#obs-grad)"/>
    <circle cx="80" cy="75" r="14" fill="#ffffff" opacity="0.9"/>
    <defs>
      <linearGradient id="obs-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3b82f6"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
    </defs>
    <text x="80" y="142" font-family="system-ui, sans-serif" font-weight="900" font-size="14" fill="#60a5fa" text-anchor="middle" letter-spacing="1">OBSIDIANA</text>
  </svg>`,

  fucsia: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" rx="36" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
    <circle cx="80" cy="70" r="28" fill="none" stroke="#ec4899" stroke-width="4"/>
    <path d="M80 32 C65 50 65 90 80 108 C95 90 95 50 80 32 Z" fill="#f472b6"/>
    <path d="M42 70 C60 55 100 55 118 70 C100 85 60 85 42 70 Z" fill="#ec4899" opacity="0.8"/>
    <text x="80" y="142" font-family="system-ui, sans-serif" font-weight="900" font-size="15" fill="#f472b6" text-anchor="middle" letter-spacing="1.5">FUCSIA</text>
  </svg>`,

  neurocortex: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" rx="36" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
    <path d="M80 35 C60 35 48 50 48 70 C48 90 62 100 80 100 C98 100 112 90 112 70 C112 50 100 35 80 35 Z" fill="none" stroke="#8b5cf6" stroke-width="4" stroke-dasharray="4 2"/>
    <circle cx="68" cy="65" r="8" fill="#a78bfa"/>
    <circle cx="92" cy="65" r="8" fill="#a78bfa"/>
    <circle cx="80" cy="82" r="10" fill="#c084fc"/>
    <line x1="68" y1="65" x2="80" y2="82" stroke="#a78bfa" stroke-width="2"/>
    <line x1="92" y1="65" x2="80" y2="82" stroke="#a78bfa" stroke-width="2"/>
    <text x="80" y="142" font-family="system-ui, sans-serif" font-weight="900" font-size="13" fill="#c084fc" text-anchor="middle" letter-spacing="1">NEUROCORTEX</text>
  </svg>`,
};

export interface BrandColors {
  primary: string[];
  secondary: string[];
}

export interface BrandFonts {
  heading: string;
  body: string;
}

export interface BrandConfig {
  id: string;
  name: string;
  logoPreset: "obsidiana" | "fucsia" | "neurocortex" | "ninguno";
  logoDataUrl?: string;
  secondaryLogoUrl?: string;
  iconUrl?: string;
  colors: BrandColors;
  typography: BrandFonts;
  styleAspects: string;
  brandGuidelines: string;
  voiceTone: string;
  projectDescription?: string;
  targetAudience?: string;
  valueProposition?: string;
  websiteUrl?: string;
}

export const DEFAULT_BRANDS: BrandConfig[] = [
  {
    id: "obsidiana",
    name: "Obsidiana",
    logoPreset: "obsidiana",
    colors: {
      primary: ["#0f172a", "#3b82f6"],
      secondary: ["#94a3b8", "#1e293b"],
    },
    typography: { heading: "Montserrat", body: "Inter" },
    styleAspects:
      "Tecnológico, empresarial, interfaz limpia, aspecto corporativo y profesional",
    brandGuidelines: "Usar contrastes altos. Evitar degradados cálidos.",
    voiceTone: "Profesional, directo y técnico.",
    projectDescription:
      "SaaS de Inteligencia Artificial para la automatización y gestión empresarial.",
  },
  {
    id: "fucsia",
    name: "Fucsia",
    logoPreset: "fucsia",
    colors: {
      primary: ["#000000", "#ec4899"],
      secondary: ["#fbcfe8", "#be185d"],
    },
    typography: { heading: "Playfair Display", body: "Outfit" },
    styleAspects: "Creativo, moderno, estético, juvenil y artístico",
    brandGuidelines:
      "Aplicar mucho espacio en blanco (negative space). Utilizar curvas orgánicas.",
    voiceTone: "Inspirador, entusiasta y creativo.",
    projectDescription:
      "Agencia creativa de diseño gráfico y desarrollo web para startups.",
  },
  {
    id: "neurocortex",
    name: "NeuroCortex",
    logoPreset: "neurocortex",
    colors: {
      primary: ["#1e1b4b", "#8b5cf6"],
      secondary: ["#c4b5fd", "#4c1d95"],
    },
    typography: { heading: "Space Grotesk", body: "Roboto Mono" },
    styleAspects:
      "Ciberpunk moderno, inteligencia artificial, futurista, luces de neón",
    brandGuidelines: "Estilo glassmorphism oscuro. Brillos sutiles.",
    voiceTone: "Futurista, analítico y vanguardista.",
    projectDescription:
      "Plataforma de análisis de datos neuro-tecnológicos y big data.",
  },
];
