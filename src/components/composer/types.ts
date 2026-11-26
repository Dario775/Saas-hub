export type PresetAspectRatioId = "1:1" | "9:16" | "4:5" | "16:9";
export type AspectRatioId = PresetAspectRatioId | "custom";

export interface CanvasDimensions {
  width: number;
  height: number;
  label: string;
  sublabel: string;
  iconName: string;
}

export const ASPECT_RATIOS: Record<PresetAspectRatioId, CanvasDimensions> = {
  "1:1": { width: 1080, height: 1080, label: "1:1 Cuadrado", sublabel: "Instagram / Feed / Facebook", iconName: "Square" },
  "9:16": { width: 1080, height: 1920, label: "9:16 Vertical", sublabel: "Stories / Reels / TikTok", iconName: "Smartphone" },
  "4:5": { width: 1080, height: 1350, label: "4:5 Retrato", sublabel: "Instagram Portrait / Ads", iconName: "Maximize2" },
  "16:9": { width: 1920, height: 1080, label: "16:9 Horizontal", sublabel: "Twitter / Banner / Web", iconName: "Tv" },
};

export interface CanvasPresetOption {
  id: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  ratioLabel: string;
}

export const POPULAR_CANVAS_PRESETS: CanvasPresetOption[] = [
  { id: "square", label: "Post Cuadrado", platform: "Instagram / Facebook", width: 1080, height: 1080, ratioLabel: "1:1" },
  { id: "story", label: "Stories & Reels", platform: "Instagram / TikTok", width: 1080, height: 1920, ratioLabel: "9:16" },
  { id: "portrait", label: "Retrato Ads", platform: "Instagram / Ads", width: 1080, height: 1350, ratioLabel: "4:5" },
  { id: "landscape", label: "Horizontal Web", platform: "YouTube / Web", width: 1920, height: 1080, ratioLabel: "16:9" },
  { id: "link-preview", label: "Post Enlace / Banner", platform: "LinkedIn / Facebook", width: 1200, height: 628, ratioLabel: "1.91:1" },
  { id: "photo-3-2", label: "Fotografía Digital", platform: "DSLR / Arte", width: 1200, height: 800, ratioLabel: "3:2" },
  { id: "standard-4-3", label: "Pantalla Estándar", platform: "Catálogos / Tablets", width: 1024, height: 768, ratioLabel: "4:3" },
  { id: "twitter-header", label: "Cabecera / Banner", platform: "Twitter / X", width: 1500, height: 500, ratioLabel: "3:1" },
];

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference";

export type LayerType = "background" | "image" | "text" | "shape" | "brand-logo";

export interface BaseLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0 to 1
  blendMode: BlendMode;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in degrees
}

export interface BackgroundLayer extends BaseLayer {
  type: "background";
  fillType: "color" | "gradient" | "image";
  color: string;
  gradientStart?: string;
  gradientEnd?: string;
  gradientAngle?: number;
  imageUrl?: string;
  promptUsed?: string;
  aiGenerator?: string;
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  imageUrl: string;
  objectFit: "cover" | "contain" | "fill";
  borderRadius?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  borderColor?: string;
  borderWidth?: number;
  promptUsed?: string;
  aiGenerator?: string;
}

export interface TextGradient {
  enabled: boolean;
  startColor: string;
  endColor: string;
  angle: number;
}

export interface TextBoxBackground {
  enabled: boolean;
  color: string;
  opacity: number;
  paddingX: number;
  paddingY: number;
  borderRadius: number;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  fontStyle: "normal" | "italic";
  color: string;
  textAlign: "left" | "center" | "right";
  letterSpacing: number; // px or %
  lineHeight: number; // multiplier e.g. 1.1
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  gradient?: TextGradient;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  glow?: boolean;
  glowColor?: string;
  boxBackground?: TextBoxBackground;
}

export type ShapeType = "rectangle" | "circle" | "pill" | "badge" | "gradient-overlay" | "divider";

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  shapeType: ShapeType;
  fillColor: string;
  fillType: "solid" | "gradient";
  gradientEnd?: string;
  gradientAngle?: number;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  shadowColor?: string;
  shadowBlur?: number;
}

export interface BrandLogoLayer extends BaseLayer {
  type: "brand-logo";
  brandId: string;
  variant: "original" | "white" | "black";
  customDataUrl?: string;
  svgPreset?: string;
}

export type CanvasLayer = BackgroundLayer | ImageLayer | TextLayer | ShapeLayer | BrandLogoLayer;

export interface FlyerFontOption {
  family: string;
  displayName: string;
  category: "Display / Impacto" | "Modern Sans" | "Elegante Serif" | "Futurista / Tech" | "Editorial";
  weights: number[];
  sampleText?: string;
}

export const FLYER_FONTS: FlyerFontOption[] = [
  { family: "Bebas Neue", displayName: "Bebas Neue (Titular Bold)", category: "Display / Impacto", weights: [400] },
  { family: "Anton", displayName: "Anton (Impacto Alto)", category: "Display / Impacto", weights: [400] },
  { family: "Inter Tight", displayName: "Inter Tight (Flyers)", category: "Modern Sans", weights: [400, 500, 600, 700, 800] },
  { family: "Inter", displayName: "Inter (Textos)", category: "Modern Sans", weights: [400, 500, 600, 700] },
  { family: "Montserrat", displayName: "Montserrat (Versátil Pro)", category: "Modern Sans", weights: [400, 700, 900] },
  { family: "Outfit", displayName: "Outfit (Geométrica Moderna)", category: "Modern Sans", weights: [400, 600, 800, 900] },
  { family: "Poppins", displayName: "Poppins (Limpia & Amigable)", category: "Modern Sans", weights: [400, 600, 800, 900] },
  { family: "Space Grotesk", displayName: "Space Grotesk (Tech / Brutalist)", category: "Futurista / Tech", weights: [500, 700] },
  { family: "Syne", displayName: "Syne (Creativa & Vanguardista)", category: "Futurista / Tech", weights: [700, 800] },
  { family: "Playfair Display", displayName: "Playfair Display (Lujo / Serif)", category: "Elegante Serif", weights: [700, 900] },
  { family: "Cinzel", displayName: "Cinzel (Clásica Premium)", category: "Elegante Serif", weights: [700, 900] },
  { family: "Oswald", displayName: "Oswald (Condensada Fuerte)", category: "Display / Impacto", weights: [600, 700] },
];

export interface FlyerTemplate {
  id: string;
  name: string;
  description: string;
  category: "Ventas / Promo" | "Lanzamiento" | "Tech / SaaS" | "Frase / Tip" | "Evento / Webinar";
  aspectRatio: AspectRatioId;
  previewGradient: string;
  createLayers: (brandColors: { primary: string[]; secondary: string[] }, brandName: string, logoId: string) => CanvasLayer[];
}

export interface TextPreset {
  id: string;
  name: string;
  category: "Titulares" | "Subtítulos & Bajadas" | "Badges & Tags" | "Precios & CTA" | "Editorial";
  description: string;
  preview: string;
  createLayer: (brandColor: string, secondaryColor: string, centerX: number, centerY: number) => Partial<TextLayer>;
}

export interface GraphicPreset {
  id: string;
  name: string;
  category: "Badges Promocionales" | "Efectos & Overlays" | "Formas Básicas";
  description: string;
  createLayers: (brandColor: string, secondaryColor: string, canvasWidth: number, canvasHeight: number) => CanvasLayer[];
}
