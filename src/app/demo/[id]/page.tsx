import { getLandingTemplate } from "@/lib/landing-templates";
import { formatWaDigits,getLeads,LeadItem } from "@/lib/leads-service";
import {
ArrowRight,
CheckCircle2,
ChevronRight,
Clock,
MapPin,
MessageCircle,
Phone,
Send,
Sparkles,
Star
} from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ brand?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const brandName = sp.brand || "Estudio Web";
  const leads = getLeads();
  const lead = leads.find((l) => l.place_id === id || l.place_id === decodeURIComponent(id));
  const name = lead ? lead.nombre : "Comercio Local";
  const rubro = lead ? lead.rubro : "Servicios";
  return {
    title: `${name} | ${rubro} en ${lead?.zona || "tu ciudad"}`,
    description: `Propuesta de sitio web para ${name}, creada por ${brandName}.`,
    robots: { index: false, follow: false },
  };
}

export default async function DemoLandingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const brandName = sp.brand || "Estudio Web";
  const leads = getLeads();
  const decodedId = decodeURIComponent(id);

  // Buscar el lead por place_id o coincidencia aproximada
  const lead: LeadItem | undefined = leads.find(
    (l) => l.place_id === id || l.place_id === decodedId
  );

  if (!lead) notFound();

  const template = getLandingTemplate(lead);
  const waDigits = formatWaDigits(lead.telefono);
  const waMessage = `Hola ${lead.nombre} 👋 Vi su sitio web y quería hacer una consulta:`;
  const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}` : "#contacto";

  return (
    <div className="min-h-screen bg-[#070710] text-slate-100 selection:bg-purple-500 selection:text-white font-sans antialiased">
      {/* 1. Barra Superior de Preview */}
      <div className="sticky top-0 z-50 bg-[#0d0d1f]/95 backdrop-blur-xl border-b border-purple-500/30 px-4 py-2.5 shadow-2xl">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
            <span className="text-slate-300">
              <strong className="text-purple-300">{brandName}</strong> • Demo en vivo creada para{" "}
              <strong className="text-white underline decoration-purple-500/50">{lead.nombre}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 hidden md:inline">¿Querés tu web lista con dominio propio?</span>
            <a
              href={`https://wa.me/5491100000000?text=${encodeURIComponent(
                `Hola 👋 Vi la demo de landing page creada para ${lead.nombre} por ${brandName} y me gustaría activarla con mi dominio y fotos oficiales.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200" />
              Activar con {brandName}
            </a>
          </div>
        </div>
      </div>

      {/* 2. Navegación Principal del Comercio */}
      <header className="border-b border-white/[0.06] bg-black/40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center font-black text-lg text-white shadow-inner">
              {lead.nombre.charAt(0)}
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight leading-none">
                {lead.nombre}
              </h1>
              <p className="text-xs text-slate-400 capitalize mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {lead.rubro} • {lead.zona}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lead.direccion && (
              <span className="text-xs text-slate-400 hidden lg:flex items-center gap-1.5 max-w-xs truncate">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                {lead.direccion}
              </span>
            )}
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
              <span>Contactar WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      {/* 3. Hero Section */}
      <section className="relative pt-12 pb-20 px-4 overflow-hidden">
        {/* Glow de fondo temático */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b ${template.gradient} opacity-20 blur-[120px] pointer-events-none rounded-full`}
        />

        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-semibold text-slate-300 backdrop-blur-md">
            <span>{template.badge}</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-emerald-400" /> {lead.rating ? `${lead.rating} · Valoración del directorio` : "Propuesta de diseño"}
            </span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
            {template.heroHeadline}
          </h2>

          <p className="text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {template.heroSubheadline}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto h-12 px-7 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <MessageCircle className="w-5 h-5 fill-white text-emerald-600" />
              {template.ctaText}
            </a>

            <a
              href="#servicios"
              className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {template.secondaryCtaText}
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Micro-beneficios bajo el CTA */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Respuesta inmediata
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Atención en {lead.zona}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Calidad asegurada
            </span>
          </div>
        </div>
      </section>

      {/* 4. Sección de Servicios / Lo que Ofrecemos */}
      <section id="servicios" className="py-16 px-4 bg-white/[0.01] border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Nuestros Servicios</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Especialistas en cada detalle
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Conocé las principales soluciones que brindamos para clientes y empresas en la zona.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {template.services.map((srv, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#0e0e1a]/90 border border-white/[0.08] hover:border-emerald-500/30 transition-all hover:-translate-y-1 space-y-3 group shadow-lg"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                  {srv.title}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {srv.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. ¿Por qué elegirnos? */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-b from-[#131326] to-[#0a0a14] border border-white/10 p-6 sm:p-12 space-y-8 relative overflow-hidden">
          <div className="space-y-2 text-center max-w-xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Por qué elegirnos</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              La tranquilidad de trabajar con los mejores
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {template.benefits.map((b, i) => (
              <div key={i} className="space-y-2 text-center sm:text-left p-4 rounded-xl bg-black/30 border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-black text-sm mb-2 mx-auto sm:mx-0">
                  0{i + 1}
                </div>
                <h4 className="font-bold text-sm text-white">{b.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 text-center">
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 group"
            >
              <span>Consultar disponibilidad y precios directamente</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* 6. Ubicación & Contacto */}
      <section id="contacto" className="py-16 px-4 bg-white/[0.01] border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-5">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Ubicación & Atención</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Vení a visitarnos o escribinos
              </h3>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              {lead.direccion && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#0e0e1a] border border-white/[0.06]">
                  <MapPin className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Dirección</p>
                    <p className="text-slate-400 mt-0.5">{lead.direccion}</p>
                  </div>
                </div>
              )}

              {lead.telefono && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#0e0e1a] border border-white/[0.06]">
                  <Phone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Teléfono / WhatsApp</p>
                    <p className="text-slate-400 mt-0.5">{lead.telefono}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#0e0e1a] border border-white/[0.06]">
                <Clock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Horarios por confirmar</p>
                  <p className="text-slate-400 mt-0.5">Consultar directamente con el comercio.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-[#0d0d1b] border border-white/10 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <MessageCircle className="w-7 h-7 fill-emerald-400 text-[#0d0d1b]" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-lg font-bold text-white">¿Tenés una consulta puntual?</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Escribinos por WhatsApp y nuestro equipo te asesorará en el acto sin compromiso.
              </p>
            </div>
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar mensaje ahora
            </a>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="border-t border-white/[0.08] py-8 px-4 bg-black/60 text-center space-y-3">
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} {lead.nombre} • Todos los derechos reservados.
        </p>
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
          <span>Diseño web & tecnología desarrollado por</span>
          <strong className="text-purple-400">{brandName}</strong>
        </p>
      </footer>

      {/* 9. Botón flotante fijo para Móviles */}
      <div className="fixed bottom-4 right-4 sm:hidden z-40">
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className="h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.6)] animate-bounce"
          title="Contactar por WhatsApp"
        >
          <MessageCircle className="w-6 h-6 fill-white text-emerald-500" />
        </a>
      </div>
    </div>
  );
}
