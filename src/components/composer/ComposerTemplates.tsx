"use client";

import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { LayoutTemplate } from "lucide-react";
import { CanvasLayer,FlyerTemplate } from "./types";

export const FLYER_TEMPLATES: FlyerTemplate[] = [
  {
    id: "sale-flash",
    name: "Mega Oferta / 50% OFF",
    description: "Flyer de alto impacto promocional con titular bold, badge de descuento y llamada a la acción.",
    category: "Ventas / Promo",
    aspectRatio: "1:1",
    previewGradient: "from-amber-600 to-rose-700",
    createLayers: (brandColors, brandName, logoId): CanvasLayer[] => {
      const primaryColor = brandColors.primary[0] || "#f59e0b";
      const secondaryColor = brandColors.secondary[0] || "#ec4899";

      return [
        {
          id: "bg-1",
          name: "Fondo Gradiente Oscuro",
          type: "background",
          visible: true,
          locked: true,
          opacity: 1,
          blendMode: "normal",
          x: 0,
          y: 0,
          width: 1080,
          height: 1080,
          rotation: 0,
          fillType: "gradient",
          color: "#0a0a0c",
          gradientStart: "#18181b",
          gradientEnd: "#09090b",
          gradientAngle: 135,
        },
        {
          id: "shape-glow",
          name: "Resplandor de Fondo",
          type: "shape",
          visible: true,
          locked: false,
          opacity: 0.25,
          blendMode: "screen",
          x: 240,
          y: 200,
          width: 600,
          height: 600,
          rotation: 0,
          shapeType: "circle",
          fillType: "solid",
          fillColor: primaryColor,
          shadowBlur: 80,
          shadowColor: primaryColor,
        },
        {
          id: "badge-top",
          name: "Badge de Oferta",
          type: "shape",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 390,
          y: 160,
          width: 300,
          height: 60,
          rotation: 0,
          shapeType: "pill",
          fillType: "solid",
          fillColor: primaryColor,
          shadowBlur: 15,
          shadowColor: "rgba(0,0,0,0.5)",
        },
        {
          id: "badge-text",
          name: "Texto Badge",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 390,
          y: 160,
          width: 300,
          height: 60,
          rotation: 0,
          text: "OFERTA POR TIEMPO LIMITADO",
          fontFamily: "Outfit",
          fontSize: 16,
          fontWeight: 800,
          fontStyle: "normal",
          color: "#09090b",
          textAlign: "center",
          letterSpacing: 2,
          lineHeight: 1,
          textTransform: "uppercase",
        },
        {
          id: "text-hero",
          name: "Titular Principal (50% OFF)",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 90,
          y: 280,
          width: 900,
          height: 260,
          rotation: 0,
          text: "HASTA 50% OFF",
          fontFamily: "Bebas Neue",
          fontSize: 140,
          fontWeight: 400,
          fontStyle: "normal",
          color: "#ffffff",
          textAlign: "center",
          letterSpacing: 4,
          lineHeight: 0.9,
          textTransform: "uppercase",
          gradient: {
            enabled: true,
            startColor: "#ffffff",
            endColor: primaryColor,
            angle: 90,
          },
          shadowBlur: 30,
          shadowColor: "rgba(0,0,0,0.9)",
          shadowOffsetY: 10,
        },
        {
          id: "text-subtitle",
          name: "Bajada / Subtítulo",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 140,
          y: 570,
          width: 800,
          height: 120,
          rotation: 0,
          text: `Aprovechá los descuentos exclusivos en toda la tienda oficial de ${brandName}.`,
          fontFamily: "Montserrat",
          fontSize: 28,
          fontWeight: 600,
          fontStyle: "normal",
          color: "#d4d4d8",
          textAlign: "center",
          letterSpacing: 0,
          lineHeight: 1.3,
          textTransform: "none",
        },
        {
          id: "cta-pill",
          name: "Botón CTA",
          type: "shape",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 340,
          y: 740,
          width: 400,
          height: 80,
          rotation: 0,
          shapeType: "pill",
          fillType: "gradient",
          fillColor: primaryColor,
          gradientEnd: secondaryColor,
          gradientAngle: 90,
          shadowBlur: 25,
          shadowColor: primaryColor,
        },
        {
          id: "cta-text",
          name: "Texto CTA",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 340,
          y: 740,
          width: 400,
          height: 80,
          rotation: 0,
          text: "COMPRAR AHORA →",
          fontFamily: "Outfit",
          fontSize: 22,
          fontWeight: 800,
          fontStyle: "normal",
          color: "#ffffff",
          textAlign: "center",
          letterSpacing: 2,
          lineHeight: 1,
          textTransform: "uppercase",
        },
        {
          id: "logo-brand",
          name: "Logo Marca",
          type: "brand-logo",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 465,
          y: 910,
          width: 150,
          height: 90,
          rotation: 0,
          brandId: logoId,
          variant: "original",
        },
      ];
    },
  },
  {
    id: "tech-launch",
    name: "Lanzamiento de Software / Feature",
    description: "Estilo futurista tech con tipografía Space Grotesk y detalles neón ideal para productos SaaS.",
    category: "Tech / SaaS",
    aspectRatio: "1:1",
    previewGradient: "from-cyan-700 to-blue-900",
    createLayers: (brandColors, brandName, logoId): CanvasLayer[] => {
      const primaryColor = brandColors.primary[0] || "#3b82f6";
      const secondaryColor = brandColors.secondary[0] || "#06b6d4";

      return [
        {
          id: "bg-1",
          name: "Fondo Espacial",
          type: "background",
          visible: true,
          locked: true,
          opacity: 1,
          blendMode: "normal",
          x: 0,
          y: 0,
          width: 1080,
          height: 1080,
          rotation: 0,
          fillType: "gradient",
          color: "#030712",
          gradientStart: "#030712",
          gradientEnd: "#0f172a",
          gradientAngle: 180,
        },
        {
          id: "badge-version",
          name: "Badge Versión",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 340,
          y: 180,
          width: 400,
          height: 50,
          rotation: 0,
          text: "🚀 NUEVA ACTUALIZACIÓN V2.0",
          fontFamily: "Space Grotesk",
          fontSize: 16,
          fontWeight: 700,
          fontStyle: "normal",
          color: secondaryColor,
          textAlign: "center",
          letterSpacing: 2,
          lineHeight: 1,
          textTransform: "uppercase",
          boxBackground: {
            enabled: true,
            color: "rgba(6, 182, 212, 0.15)",
            opacity: 1,
            paddingX: 20,
            paddingY: 10,
            borderRadius: 20,
          },
        },
        {
          id: "text-title",
          name: "Titular Lanzamiento",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 80,
          y: 280,
          width: 920,
          height: 240,
          rotation: 0,
          text: "AUTOMATIZA TUS REDES\nCON INTELIGENCIA",
          fontFamily: "Space Grotesk",
          fontSize: 72,
          fontWeight: 700,
          fontStyle: "normal",
          color: "#ffffff",
          textAlign: "center",
          letterSpacing: -1,
          lineHeight: 1.1,
          textTransform: "uppercase",
          shadowBlur: 20,
          shadowColor: secondaryColor,
        },
        {
          id: "text-desc",
          name: "Descripción de Valor",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 140,
          y: 560,
          width: 800,
          height: 100,
          rotation: 0,
          text: `Generá creatividades, redactá copys y publicá en automático con la tecnología de ${brandName}.`,
          fontFamily: "Outfit",
          fontSize: 24,
          fontWeight: 400,
          fontStyle: "normal",
          color: "#94a3b8",
          textAlign: "center",
          letterSpacing: 0,
          lineHeight: 1.4,
          textTransform: "none",
        },
        {
          id: "cta-pill",
          name: "Botón Probar Gratis",
          type: "shape",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 360,
          y: 720,
          width: 360,
          height: 70,
          rotation: 0,
          shapeType: "pill",
          fillType: "gradient",
          fillColor: secondaryColor,
          gradientEnd: primaryColor,
          gradientAngle: 90,
          shadowBlur: 25,
          shadowColor: secondaryColor,
        },
        {
          id: "cta-text",
          name: "Texto Probar Gratis",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 360,
          y: 720,
          width: 360,
          height: 70,
          rotation: 0,
          text: "PROBAR GRATIS",
          fontFamily: "Space Grotesk",
          fontSize: 20,
          fontWeight: 700,
          fontStyle: "normal",
          color: "#030712",
          textAlign: "center",
          letterSpacing: 2,
          lineHeight: 1,
          textTransform: "uppercase",
        },
        {
          id: "logo-brand",
          name: "Logo Marca",
          type: "brand-logo",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 465,
          y: 890,
          width: 150,
          height: 90,
          rotation: 0,
          brandId: logoId,
          variant: "original",
        },
      ];
    },
  },
  {
    id: "quote-tip",
    name: "Frase de Impacto / Tip de Experto",
    description: "Diseño editorial elegante con fuente serif Playfair Display ideal para construir autoridad de marca.",
    category: "Frase / Tip",
    aspectRatio: "1:1",
    previewGradient: "from-purple-950 to-zinc-900",
    createLayers: (brandColors, brandName, logoId): CanvasLayer[] => {
      const primaryColor = brandColors.primary[0] || "#8b5cf6";

      return [
        {
          id: "bg-1",
          name: "Fondo Carbón Profundo",
          type: "background",
          visible: true,
          locked: true,
          opacity: 1,
          blendMode: "normal",
          x: 0,
          y: 0,
          width: 1080,
          height: 1080,
          rotation: 0,
          fillType: "color",
          color: "#09090b",
        },
        {
          id: "quote-icon",
          name: "Comillas Gigantes",
          type: "text",
          visible: true,
          locked: false,
          opacity: 0.15,
          blendMode: "normal",
          x: 100,
          y: 120,
          width: 200,
          height: 200,
          rotation: 0,
          text: "“",
          fontFamily: "Playfair Display",
          fontSize: 280,
          fontWeight: 900,
          fontStyle: "normal",
          color: primaryColor,
          textAlign: "left",
          letterSpacing: 0,
          lineHeight: 1,
          textTransform: "none",
        },
        {
          id: "text-quote",
          name: "Cuerpo de la Frase",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 120,
          y: 320,
          width: 840,
          height: 360,
          rotation: 0,
          text: "“El contenido de calidad no compite por atención: la atrae de manera natural.”",
          fontFamily: "Playfair Display",
          fontSize: 48,
          fontWeight: 700,
          fontStyle: "italic",
          color: "#f4f4f5",
          textAlign: "center",
          letterSpacing: 0,
          lineHeight: 1.35,
          textTransform: "none",
        },
        {
          id: "divider",
          name: "Línea Divisoria",
          type: "shape",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 440,
          y: 720,
          width: 200,
          height: 3,
          rotation: 0,
          shapeType: "rectangle",
          fillType: "solid",
          fillColor: primaryColor,
        },
        {
          id: "author-name",
          name: "Autor / Marca",
          type: "text",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 200,
          y: 760,
          width: 680,
          height: 60,
          rotation: 0,
          text: `${brandName.toUpperCase()} · CONSEJO DEL DÍA`,
          fontFamily: "Montserrat",
          fontSize: 16,
          fontWeight: 700,
          fontStyle: "normal",
          color: "#a1a1aa",
          textAlign: "center",
          letterSpacing: 3,
          lineHeight: 1,
          textTransform: "uppercase",
        },
        {
          id: "logo-brand",
          name: "Logo Marca",
          type: "brand-logo",
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          x: 465,
          y: 890,
          width: 150,
          height: 90,
          rotation: 0,
          brandId: logoId,
          variant: "original",
        },
      ];
    },
  },
];

interface ComposerTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: FlyerTemplate) => void;
}

export function ComposerTemplatesModal({
  isOpen,
  onClose,
  onSelectTemplate,
}: ComposerTemplatesModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-gradient-to-r from-amber-500 to-rose-500">
              <LayoutTemplate className="w-4 h-4 text-white" />
            </div>
            <DialogTitle className="text-base font-bold text-zinc-100">
              Plantillas Profesionales de Flyer
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-zinc-400">
            Elige una plantilla base. Se adaptará automáticamente con los colores, tipografía y logo de tu marca.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3">
          {FLYER_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => {
                onSelectTemplate(tmpl);
                onClose();
              }}
              className="group relative flex flex-col p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-amber-500/60 transition-all cursor-pointer shadow-md overflow-hidden"
            >
              {/* Preview Gráfico */}
              <div
                className={`w-full h-32 rounded-lg bg-gradient-to-br ${tmpl.previewGradient} flex flex-col items-center justify-center p-3 text-center shadow-inner relative overflow-hidden group-hover:scale-[1.02] transition-transform`}
              >
                <div className="absolute inset-0 bg-black/20" />
                <span className="relative z-10 text-xs font-black tracking-wider uppercase text-white drop-shadow">
                  {tmpl.name}
                </span>
                <span className="relative z-10 text-[10px] text-white/80 mt-1 font-mono">
                  {tmpl.aspectRatio}
                </span>
              </div>

              {/* Info de la plantilla */}
              <div className="mt-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                      {tmpl.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                    {tmpl.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-zinc-800 text-[11px] text-amber-300 font-medium group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Usar Plantilla →
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
