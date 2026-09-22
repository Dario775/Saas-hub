"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LeadItem,LeadStatus } from "@/lib/leads-service";
import type { OpportunityResult } from "@/lib/opportunity-types";
import { LocationItem,PREDEFINED_LOCATIONS } from "@/lib/location-data";
import {
AlertCircle,
Building2,
Check,
CheckCircle,
Compass,
Download,
ExternalLink,
Globe,
Key,
Loader2,
Mail,
MapPin,
MessageSquare,
Phone,
RefreshCw,
Search,
Sparkles,
Star,
Trash2,
Users,
X,
Zap
} from "lucide-react";
import { useEffect,useState } from "react";
import { toast } from "sonner";

const POPULAR_LOCATIONS: LocationItem[] = PREDEFINED_LOCATIONS.filter((l) =>
  [
    "caba-palermo",
    "gba-san-isidro",
    "sfe-rosario",
    "cba-cordoba-capital",
    "mdz-godoy-cruz",
    "pba-mar-del-plata",
    "pba-la-plata",
  ].includes(l.id)
);

interface LeadsViewProps {
  brandContext?: any;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; badgeClass: string }> = {
  nuevo: {
    label: "Nuevo",
    color: "slate",
    badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  },
  contactado: {
    label: "Contactado",
    color: "blue",
    badgeClass: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  },
  respondio: {
    label: "Respondió",
    color: "amber",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
  demo: {
    label: "Demo Agendada",
    color: "purple",
    badgeClass: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  },
  cliente: {
    label: "Cliente Cerrado",
    color: "emerald",
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  },
  descartado: {
    label: "Descartado",
    color: "red",
    badgeClass: "bg-red-500/10 text-red-300 border-red-500/20",
  },
};

const SUGGESTED_RUBROS = [
  "Ferretería",
  "Gimnasio",
  "Restaurante",
  "Tienda de ropa",
  "Peluquería",
  "Clínica dental",
  "Veterinaria",
];

export function LeadsView({ brandContext }: LeadsViewProps) {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  const activeBrandName = brandContext?.name || "Tu Marca";
  const activeValueProp =
    brandContext?.identity?.valueProposition ||
    brandContext?.description ||
    "Diseño y desarrollo de Landing Pages interactivas de alta conversión con dominio propio y WhatsApp directo";
  const activeTone = brandContext?.voiceTone || "profesional, persuasivo y consultivo";

  // Filtros de búsqueda y vista
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [searchFilter, setSearchFilter] = useState("");

  // Motor de Búsqueda Dual: OpenStreetMap (libre) o Google Places API
  const [engine, setEngine] = useState<"osm" | "google">("osm");
  const [googleConfig, setGoogleConfig] = useState<{ configured: boolean; maskedKey: string }>({
    configured: false,
    maskedKey: "",
  });
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  // Formulario de prospección y Ubicación Georreferenciada
  const [rubroInput, setRubroInput] = useState("Ferretería");
  const [zonaInput, setZonaInput] = useState("Palermo, CABA");
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(PREDEFINED_LOCATIONS[0]);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationItem[]>(PREDEFINED_LOCATIONS.slice(0, 8));
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [searching, setSearching] = useState(false);
  const [scrapingEmails, setScrapingEmails] = useState(false);

  // Análisis de oportunidad: acción manual, no contacta a nadie
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisLead, setAnalysisLead] = useState<LeadItem | null>(null);
  const [analysisResult, setAnalysisResult] = useState<OpportunityResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Modo de acumulación o reemplazo de resultados
  const [searchMode, setSearchMode] = useState<"replace" | "append">("replace");
  const [selectedBatch, setSelectedBatch] = useState<string>("todos");
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearingLeads, setClearingLeads] = useState(false);

  // Modal de Pitch IA
  const [activeLeadForPitch, setActiveLeadForPitch] = useState<LeadItem | null>(null);
  const [pitchText, setPitchText] = useState("");
  const [generatingPitch, setGeneratingPitch] = useState(false);

  async function handleClearLeads(mode: "onlyNew" | "all") {
    setClearingLeads(true);
    try {
      const res = await fetch(`/api/leads?${mode}=true`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        setStats(data.stats || null);
        setSelectedBatch("todos");
        setIsClearModalOpen(false);
        toast.success(
          mode === "all"
            ? "Lista vaciada por completo"
            : "Prospectos no contactados eliminados (clientes y demos protegidos)"
        );
      } else {
        toast.error("Error al limpiar prospectos", { description: data.error });
      }
    } catch {
      toast.error("Error de conexión al limpiar prospectos");
    } finally {
      setClearingLeads(false);
    }
  }

  // Autocompletado de ubicaciones con debounce
  useEffect(() => {
    if (!showLocationDropdown) return;
    const timer = setTimeout(async () => {
      setLoadingLocations(true);
      try {
        const res = await fetch(`/api/leads/locations?q=${encodeURIComponent(zonaInput)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.locations)) {
          setLocationSuggestions(data.locations);
        }
      } catch {
        // mantener anteriores
      } finally {
        setLoadingLocations(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [zonaInput, showLocationDropdown]);

  // Cargar leads y estado de configuración al montar
  useEffect(() => {
    fetchLeads();
    checkGoogleConfig();
  }, []);

  async function checkGoogleConfig() {
    try {
      const res = await fetch("/api/leads/config");
      const data = await res.json();
      if (data.success) {
        setGoogleConfig({ configured: data.configured, maskedKey: data.maskedKey });
        if (data.configured) {
          setEngine("google");
        }
      }
    } catch {
      // continuar
    }
  }

  async function handleSaveGoogleKey() {
    if (!apiKeyInput.trim()) {
      toast.error("Ingresa una clave de API válida");
      return;
    }
    setSavingKey(true);
    try {
      const res = await fetch("/api/leads/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setGoogleConfig({ configured: data.configured, maskedKey: data.maskedKey });
        setEngine("google");
        setIsConfigModalOpen(false);
        setApiKeyInput("");
        toast.success("¡Google Places API Key guardada exitosamente!");
      } else {
        toast.error("Error al guardar la clave", { description: data.error });
      }
    } catch {
      toast.error("Error de conexión al guardar la clave");
    } finally {
      setSavingKey(false);
    }
  }

  async function fetchLeads() {
    try {
      setLoading(true);
      const res = await fetch("/api/leads");
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        setStats(data.stats || null);
      } else throw new Error(data.error || "No se pudieron cargar los prospectos");
    } catch (err: any) {
      toast.error("Error al cargar la base de prospectos");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchLeads() {
    if (!rubroInput.trim() || !zonaInput.trim()) {
      toast.error("Ingresá un rubro y una zona para buscar.");
      return;
    }

    if (engine === "google" && !googleConfig.configured) {
      toast.error("Falta configurar tu Google Places API Key. Abre 'Configurar Clave' o selecciona OpenStreetMap.");
      setIsConfigModalOpen(true);
      return;
    }

    setSearching(true);
    const engineLabel = engine === "google" ? "Google Maps (Places API)" : "OpenStreetMap (Libre)";
    toast.loading(`Buscando comercios vía ${engineLabel}...`, { id: "search-leads" });

    try {
      const res = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rubro: rubroInput.trim(),
          zona: zonaInput.trim(),
          engine,
          searchMode,
          locationData: selectedLocation
            ? {
                lat: selectedLocation.lat,
                lon: selectedLocation.lon,
                boundingbox: selectedLocation.boundingbox,
                display: selectedLocation.display,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      toast.dismiss("search-leads");

      if (data.success) {
        setLeads(data.leads || []);
        setStats(data.stats || null);
        setSelectedBatch("todos");
        const actionLabel = searchMode === "replace" ? "Lista actualizada con" : "Añadidos";
        toast.success(`¡${actionLabel} ${data.foundCount} nuevos prospectos vía ${engineLabel}!`);
      } else {
        toast.error("Error en la búsqueda", { description: data.error });
      }
    } catch (err: any) {
      toast.dismiss("search-leads");
      toast.error("Error de conexión al buscar prospectos");
    } finally {
      setSearching(false);
    }
  }

  async function handleScrapeEmails() {
    setScrapingEmails(true);
    toast.loading("Escaneando sitios web en busca de emails...", { id: "scrape-emails" });

    try {
      const res = await fetch("/api/leads/scrape-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 15 }),
      });
      const data = await res.json();
      toast.dismiss("scrape-emails");

      if (data.success) {
        setLeads(data.leads || []);
        setStats(data.stats || null);
        if (data.foundCount > 0) {
          toast.success(`Se descubrieron ${data.foundCount} correos electrónicos nuevos.`);
        } else {
          toast.info("Escaneo finalizado sin nuevos correos detectados.");
        }
      } else {
        toast.error("Error al escanear correos", { description: data.error });
      }
    } catch {
      toast.dismiss("scrape-emails");
      toast.error("Error de conexión durante el escaneo");
    } finally {
      setScrapingEmails(false);
    }
  }

  async function handleAnalyzeOpportunity(lead: LeadItem) {
    setAnalysisLead(lead);
    setAnalysisResult(null);
    setAnalysisError(null);
    setAnalyzingId(lead.place_id);
    try {
      const res = await fetch("/api/leads/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: lead.place_id }),
      });
      const data = await res.json();
      if (data.lead) {
        setLeads((prev) =>
          prev.map((item) => (item.place_id === data.lead.place_id ? data.lead : item)),
        );
      }
      if (data.result) {
        setAnalysisResult(data.result);
        if (data.result.error) setAnalysisError(data.result.error);
      } else {
        setAnalysisError(data.error || "No se pudo analizar la oportunidad.");
      }
    } catch {
      setAnalysisError("Error de conexión durante el análisis.");
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleStatusChange(placeId: string, newStatus: LeadStatus) {
    try {
      const res = await fetch("/api/leads/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads);
        setStats(data.stats);
        toast.success(`Estado actualizado a "${STATUS_CONFIG[newStatus].label}"`);
      }
    } catch {
      toast.error("No se pudo actualizar el estado.");
    }
  }

  async function handleDeleteLead(placeId: string) {
    if (!confirm("¿Seguro que deseas eliminar este prospecto del CRM?")) return;

    try {
      const res = await fetch(`/api/leads?placeId=${encodeURIComponent(placeId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads);
        setStats(data.stats);
        toast.success("Prospecto eliminado");
      }
    } catch {
      toast.error("Error al eliminar el prospecto.");
    }
  }

  async function handleOpenPitchModal(lead: LeadItem) {
    setActiveLeadForPitch(lead);
    setPitchText(lead.customPitch || "");
    setGeneratingPitch(true);

    try {
      const res = await fetch("/api/leads/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead,
          brandName: activeBrandName,
          valueProposition: activeValueProp,
          voiceTone: activeTone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPitchText(data.pitch);
        // Actualizar en la lista local
        setLeads((prev) =>
          prev.map((l) => (l.place_id === lead.place_id ? data.lead : l))
        );
      }
    } catch {
      toast.error("Error al redactar el pitch con IA.");
    } finally {
      setGeneratingPitch(false);
    }
  }

  function handleSaveCustomPitch() {
    if (!activeLeadForPitch) return;
    handleStatusChange(activeLeadForPitch.place_id, activeLeadForPitch.status);
    setActiveLeadForPitch(null);
    toast.success("Mensaje guardado para el prospecto");
  }

  function handleExportCsv() {
    if (leads.length === 0) {
      toast.error("No hay prospectos para exportar.");
      return;
    }

    const header = "Nombre,Rubro,Zona,Direccion,Telefono,Email,Website,Rating,Estado,Notas";
    const rows = leads.map((l) =>
      [
        l.nombre,
        l.rubro,
        l.zona,
        l.direccion || "",
        l.telefono || "",
        l.email || "",
        l.website || "",
        l.rating || "",
        STATUS_CONFIG[l.status]?.label || l.status,
        l.notes || "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );

    const blob = new Blob(["\ufeff" + [header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospectos-crm-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado exitosamente para Excel / Sheets");
  }

  // Lotes de búsqueda únicos
  const availableBatches = Array.from(
    new Set(leads.map((l) => l.batch).filter(Boolean))
  ) as string[];

  // Filtrado de leads
  const filteredLeads = leads.filter((lead) => {
    if (selectedStatus !== "todos" && lead.status !== selectedStatus) {
      return false;
    }
    if (selectedBatch !== "todos" && lead.batch && lead.batch !== selectedBatch) {
      return false;
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        lead.nombre.toLowerCase().includes(q) ||
        lead.rubro.toLowerCase().includes(q) ||
        lead.zona.toLowerCase().includes(q) ||
        (lead.batch && lead.batch.toLowerCase().includes(q)) ||
        (lead.direccion && lead.direccion.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      {/* Header & Stats Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent inline-flex items-center gap-2">
            <Compass className="w-6 h-6 text-emerald-400" />
            Prospección B2B & Motor de Adquisición
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Encuentra clientes locales en Google Maps, descubre sus datos de contacto y envíales propuestas hiper-personalizadas por WhatsApp y Email.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScrapeEmails}
            disabled={scrapingEmails || leads.length === 0}
            className="h-9 border-white/10 hover:bg-white/5 text-slate-300 text-xs gap-1.5"
            title="Escanear sitios web de los prospectos para extraer correos electrónicos"
          >
            {scrapingEmails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5 text-cyan-400" />}
            Escanear Emails
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={leads.length === 0}
            className="h-9 border-white/10 hover:bg-white/5 text-slate-300 text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Exportar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsClearModalOpen(true)}
            disabled={leads.length === 0}
            className="h-9 border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-slate-300 hover:text-red-300 text-xs gap-1.5"
            title="Limpiar prospectos no contactados o vaciar la lista"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            Limpiar Lista
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchLeads()}
            className="h-9 w-9 p-0 border border-white/10 hover:bg-white/5 text-slate-400"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Negocio */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-[#0b0b14]/80 border-white/[0.08] relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-[30px] pointer-events-none" />
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Prospectos</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">{stats?.total || 0}</h3>
              <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                <Users className="w-3 h-3" /> Base activa
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0b14]/80 border-white/[0.08] relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-[30px] pointer-events-none" />
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Con WhatsApp</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">{stats?.conTelefono || 0}</h3>
              <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1 font-medium">
                <Phone className="w-3 h-3" /> Listos para mensaje
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0b14]/80 border-white/[0.08] relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-[30px] pointer-events-none" />
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Con Email</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">{stats?.conEmail || 0}</h3>
              <p className="text-[10px] text-cyan-400 mt-1 flex items-center gap-1 font-medium">
                <Mail className="w-3 h-3" /> Verificados
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0b14]/80 border-white/[0.08] relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-[30px] pointer-events-none" />
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En Negociación / Demos</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
                {(stats?.porEstado?.demo || 0) + (stats?.porEstado?.respondio || 0)}
              </h3>
              <p className="text-[10px] text-purple-400 mt-1 flex items-center gap-1 font-medium">
                <Zap className="w-3 h-3" /> Pipeline de ventas
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Star className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel de Búsqueda y Extracción Dual: OpenStreetMap & Google Places */}
      <Card className="bg-[#0b0b14] border-white/[0.08] relative overflow-visible shadow-2xl z-30">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-t-xl pointer-events-none" />
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-400" />
                Explorador de Comercios Locales
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-0.5">
                Escanea negocios reales en cualquier ciudad o barrio y tráelos automáticamente al CRM de prospección.
              </CardDescription>
            </div>

            {/* Selector de Controles: Modo y Motor */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {/* Selector de Modo: Reemplazar vs Acumular */}
              <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setSearchMode("replace")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    searchMode === "replace"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Cada búsqueda renueva los resultados de la lista, protegiendo clientes y demos"
                >
                  <RefreshCw className="w-3 h-3 text-emerald-400" />
                  Reemplazar lista
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("append")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    searchMode === "append"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Suma los nuevos prospectos a la base existente sin borrar los anteriores"
                >
                  <Users className="w-3 h-3 text-purple-400" />
                  Acumular
                </button>
              </div>

              {/* Selector de Motor Dual */}
              <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setEngine("osm")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    engine === "osm"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  OpenStreetMap
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] px-1 py-0 ml-0.5">
                    100% Gratis
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => setEngine("google")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    engine === "google"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                  Google Places
                  {googleConfig.configured ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] px-1 py-0 ml-0.5 flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" /> Activo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] px-1 py-0 ml-0.5">
                      Clave
                    </Badge>
                  )}
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsConfigModalOpen(true)}
                  className="h-7 px-2 text-slate-400 hover:text-white text-[11px] flex items-center gap-1 border border-white/5 hover:border-white/10"
                  title="Configurar Google Places API Key"
                >
                  <Key className="w-3 h-3 text-cyan-400" />
                  <span className="hidden lg:inline">{googleConfig.configured ? "Modificar Clave" : "Configurar Clave"}</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Banner de información de Modo de Búsqueda */}
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              {searchMode === "replace" ? (
                <>
                  <RefreshCw className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Modo <strong>Reemplazar activo</strong>: Muestra solo los resultados de esta búsqueda. Tus clientes y demos se protegen automáticamente.</span>
                </>
              ) : (
                <>
                  <Users className="w-3 h-3 text-purple-400 shrink-0" />
                  <span>Modo <strong>Acumulativo activo</strong>: Cada nuevo comercio se sumará a la base histórica de prospectos.</span>
                </>
              )}
            </span>
            <span className="text-[10px] text-slate-500 font-mono hidden md:inline shrink-0 ml-2">
              {searchMode === "replace" ? "Solo búsqueda actual" : "Base acumulativa"}
            </span>
          </div>
          {/* Banner si seleccionó Google y no tiene clave configurada */}
          {engine === "google" && !googleConfig.configured && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Para usar Google Maps necesitas configurar tu <strong>Google Places API Key</strong>. Si no tienes una, puedes usar <strong>OpenStreetMap</strong> gratis sin registrar ninguna tarjeta.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEngine("osm")}
                  className="h-7 text-[11px] border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                >
                  Usar OpenStreetMap gratis
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsConfigModalOpen(true)}
                  className="h-7 text-[11px] bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                >
                  Configurar API Key
                </Button>
              </div>
            </div>
          )}

          {/* Banner informativo de OpenStreetMap */}
          {engine === "osm" && (
            <div className="px-3 py-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300/90">
              <span className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                Motor <strong>OpenStreetMap / Nominatim</strong> activo: Extracción directa de base comercial abierta, sin costos ni consumo de cuotas.
              </span>
              <span className="text-[11px] text-emerald-400/70 hidden sm:inline font-mono">Modo Libre</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Rubro / Categoría comercial</label>
              <Input
                placeholder="Ej. Gimnasio, Ferretería, Inmobiliaria"
                value={rubroInput}
                onChange={(e) => setRubroInput(e.target.value)}
                className="bg-black/40 border-white/10 text-white text-sm focus-visible:ring-emerald-500"
              />
            </div>
            <div className="sm:col-span-5 space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Zona / Localidad o Provincia
                </label>
                {selectedLocation && (
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> Ubicación verificada
                  </span>
                )}
              </div>

              <div className="relative">
                <Input
                  placeholder="Escribe una localidad o provincia..."
                  value={zonaInput}
                  onChange={(e) => {
                    setZonaInput(e.target.value);
                    setShowLocationDropdown(true);
                    if (selectedLocation && selectedLocation.display !== e.target.value) {
                      setSelectedLocation(null);
                    }
                  }}
                  onFocus={() => setShowLocationDropdown(true)}
                  className={`bg-black/40 border-white/10 text-white text-sm focus-visible:ring-emerald-500 pl-8 pr-7 ${
                    selectedLocation ? "border-emerald-500/50 bg-emerald-950/15 text-emerald-200" : ""
                  }`}
                />
                <MapPin
                  className={`w-4 h-4 absolute left-2.5 top-2.5 pointer-events-none ${
                    selectedLocation ? "text-emerald-400" : "text-slate-400"
                  }`}
                />
                {zonaInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setZonaInput("");
                      setSelectedLocation(null);
                      setShowLocationDropdown(true);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 text-xs"
                    title="Limpiar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Menú Desplegable de Autocompletado de Ubicaciones */}
              {showLocationDropdown && (
                <>
                  {/* Backdrop invisible para cerrar al hacer clic afuera */}
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setShowLocationDropdown(false)}
                  />

                  {/* Lista flotante sobre todo el contenido */}
                  <div
                    className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-[#0f0f1c] border border-white/20 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-2xl max-h-72 overflow-y-auto divide-y divide-white/5"
                  >
                    <div className="px-3 py-1.5 bg-black/60 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between sticky top-0 backdrop-blur-md z-10 border-b border-white/5">
                      <span>Ubicaciones exactas disponibles</span>
                      {loadingLocations && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
                    </div>

                    {locationSuggestions.length === 0 && !loadingLocations ? (
                      <div className="px-3 py-3 text-xs text-slate-400 text-center">
                        No hay coincidencias exactas para &quot;{zonaInput}&quot;. Se geolocalizará automáticamente al buscar.
                      </div>
                    ) : (
                      locationSuggestions.map((loc) => (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => {
                            setSelectedLocation(loc);
                            setZonaInput(loc.display);
                            setShowLocationDropdown(false);
                            toast.success(`Ubicación fijada: ${loc.display}`);
                          }}
                          className="w-full px-3 py-2.5 text-left hover:bg-emerald-500/15 transition-colors flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                            <div>
                              <p className="text-xs font-semibold text-white group-hover:text-emerald-300">
                                {loc.name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {loc.provincia}, {loc.pais}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 capitalize bg-white/[0.03] border-white/10 text-slate-300"
                          >
                            {loc.type}
                          </Badge>
                        </button>
                      ))
                    )}

                    <div className="p-1.5 bg-black/70 text-right sticky bottom-0 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => setShowLocationDropdown(false)}
                        className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded"
                      >
                        Cerrar lista
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="sm:col-span-2 flex items-end">
              <Button
                onClick={handleSearchLeads}
                disabled={searching}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] h-9"
              >
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Search className="w-3.5 h-3.5 mr-1" />}
                {engine === "google" ? "Buscar Google" : "Buscar Libre"}
              </Button>
            </div>
          </div>

          {/* Sugerencias de Rubros y Ubicaciones Rápidas */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Sugeridos:</span>
              {SUGGESTED_RUBROS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRubroInput(r)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border border-white/[0.06] transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Zonas Populares:</span>
              {POPULAR_LOCATIONS.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    setSelectedLocation(loc);
                    setZonaInput(loc.display);
                    setShowLocationDropdown(false);
                    toast.success(`Ubicación seleccionada: ${loc.display}`);
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors flex items-center gap-1 ${
                    selectedLocation?.id === loc.id
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold shadow-sm"
                      : "bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border-white/[0.06]"
                  }`}
                >
                  <MapPin className="w-2.5 h-2.5" />
                  {loc.display}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barra de Filtros del Pipeline CRM */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedStatus("todos")}
            className={`h-8 text-xs rounded-xl px-3 ${
              selectedStatus === "todos"
                ? "bg-emerald-600 text-white font-semibold"
                : "bg-white/[0.03] text-slate-400 hover:text-white"
            }`}
          >
            Todos ({leads.length})
          </Button>

          {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((st) => {
            const count = stats?.porEstado?.[st] || 0;
            return (
              <Button
                key={st}
                size="sm"
                variant="ghost"
                onClick={() => setSelectedStatus(st)}
                className={`h-8 text-xs rounded-xl px-2.5 ${
                  selectedStatus === st
                    ? "bg-emerald-600 text-white font-semibold"
                    : "bg-white/[0.03] text-slate-400 hover:text-white"
                }`}
              >
                {STATUS_CONFIG[st].label} ({count})
              </Button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {availableBatches.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs shrink-0">
              <Select value={selectedBatch} onValueChange={(val) => setSelectedBatch(val || "todos")}>
                <SelectTrigger className="h-8 bg-black/40 border-white/10 text-white text-xs w-[160px] sm:w-[190px]">
                  <SelectValue placeholder="Todas las búsquedas" />
                </SelectTrigger>
                <SelectContent className="bg-[#121220] border-white/10 text-white text-xs max-h-60">
                  <SelectItem value="todos">Todas las búsquedas ({leads.length})</SelectItem>
                  {availableBatches.map((b) => {
                    const bCount = leads.filter((l) => l.batch === b).length;
                    return (
                      <SelectItem key={b} value={b}>
                        {b} ({bCount})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Filtrar prospectos..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 pl-8 text-xs bg-black/40 border-white/10 text-white focus-visible:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Grid de Prospectos */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
          <p className="text-xs text-slate-400">Cargando base de datos de prospección...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="py-16 text-center space-y-3 border border-dashed border-white/10 rounded-2xl bg-[#0b0b14]/50">
          <Building2 className="w-10 h-10 mx-auto text-slate-600" />
          <h4 className="text-sm font-bold text-white">No se encontraron prospectos</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchFilter || selectedStatus !== "todos"
              ? "Prueba cambiando los filtros seleccionados."
              : "Usa el buscador superior para encontrar prospectos en Google Maps y agregarlos a tu pipeline."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => {
            const hasPhone = !!lead.telefono;
            const hasEmail = !!lead.email;
            const hasWeb = !!lead.website;

            return (
              <Card
                key={lead.place_id}
                className="bg-[#0b0b14] border-white/[0.08] hover:border-white/[0.15] transition-all flex flex-col justify-between group overflow-hidden"
              >
                <div className="p-4 space-y-3">
                  {/* Cabecera de la ficha */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                        {lead.nombre}
                      </h4>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/[0.04] text-slate-300 border-white/10">
                          {lead.rubro}
                        </Badge>
                        {lead.rating && (
                          <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-400" /> {lead.rating}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Selector de Estado en el CRM */}
                    <Select
                      value={lead.status}
                      onValueChange={(val) => {
                        if (val) handleStatusChange(lead.place_id, val as LeadStatus);
                      }}
                    >
                      <SelectTrigger className={`h-6 text-[10px] font-semibold border px-2 w-auto ${STATUS_CONFIG[lead.status]?.badgeClass || ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12121e] border-white/10 text-xs">
                        {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((st) => (
                          <SelectItem key={st} value={st} className="text-xs">
                            {STATUS_CONFIG[st].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Datos de contacto y ubicación */}
                  <div className="space-y-1.5 text-xs text-slate-400 pt-1 border-t border-white/[0.05]">
                    {lead.direccion && (
                      <p className="flex items-start gap-1.5 text-[11px] line-clamp-1" title={lead.direccion}>
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span className="truncate">{lead.direccion}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px]">
                      {hasPhone ? (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Phone className="w-3 h-3 text-green-400" /> {lead.telefono}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">Sin teléfono</span>
                      )}

                      {hasEmail ? (
                        <span className="flex items-center gap-1 text-cyan-300 truncate" title={lead.email}>
                          <Mail className="w-3 h-3 text-cyan-400 shrink-0" /> {lead.email}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">Sin email</span>
                      )}
                    </div>

                    {hasWeb ? (
                      <a
                        href={lead.website!.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline pt-0.5"
                      >
                        <Globe className="w-3 h-3" /> {lead.website!.replace(/^https?:\/\//, "").slice(0, 30)}
                      </a>
                    ) : (
                      <div className="flex items-center justify-between pt-1 text-[10px]">
                        <span className="text-purple-400 font-semibold flex items-center gap-1 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                          <Sparkles className="w-2.5 h-2.5" /> Oportunidad Web
                        </span>
                        <a
                          href={`/demo/${encodeURIComponent(lead.place_id)}?brand=${encodeURIComponent(activeBrandName)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-300 hover:text-white font-bold flex items-center gap-1 hover:underline"
                          title={`Ver landing page demo creada por ${activeBrandName} para este comercio`}
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> Ver Demo {activeBrandName}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Notas o Pitch personalizado */}
                  {lead.customPitch && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 text-[11px] text-emerald-200 line-clamp-2">
                      <strong className="text-emerald-400">Pitch IA:</strong> {lead.customPitch}
                    </div>
                  )}
                </div>

                {/* Acciones del Lead */}
                <div className="p-3 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Botón WhatsApp */}
                    {hasPhone && lead.whatsappLink ? (
                      <a
                        href={lead.whatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleStatusChange(lead.place_id, "contactado")}
                        className="h-8 px-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-[0_0_10px_rgba(34,197,94,0.2)] transition-all"
                        title="Abrir WhatsApp Web con mensaje listo"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    ) : (
                      <Button
                        size="sm"
                        disabled
                        variant="ghost"
                        className="h-8 px-2 text-[11px] text-slate-600"
                      >
                        Sin WhatsApp
                      </Button>
                    )}

                    {/* Botón Email */}
                    {hasEmail && (
                      <a
                        href={`mailto:${lead.email}?subject=${encodeURIComponent(`Consulta para ${lead.nombre}`)}`}
                        onClick={() => handleStatusChange(lead.place_id, "contactado")}
                        className="h-8 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-[11px] flex items-center gap-1 border border-white/10"
                        title="Enviar correo"
                      >
                        <Mail className="w-3.5 h-3.5 text-cyan-400" />
                      </a>
                    )}

                    {/* Botón Generar Pitch con IA */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAnalyzeOpportunity(lead)}
                      disabled={analyzingId === lead.place_id}
                      className="h-8 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-1 border border-emerald-500/20"
                      title="Analizar la oportunidad comercial (no contacta a nadie)"
                    >
                      {analyzingId === lead.place_id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Compass className="w-3 h-3 text-emerald-400" />
                      )}
                      Analizar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenPitchModal(lead)}
                      className="h-8 px-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] flex items-center gap-1 border border-purple-500/20"
                      title="Redactar o editar pitch de venta con IA"
                    >
                      <Sparkles className="w-3 h-3 text-purple-400" /> Pitch
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteLead(lead.place_id)}
                    className="h-8 w-8 p-0 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                    title="Eliminar de la lista"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Redacción y Personalización de Pitch IA */}
      <Dialog open={!!activeLeadForPitch} onOpenChange={(open) => !open && setActiveLeadForPitch(null)}>
        <DialogContent className="bg-[#0e0e18] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-purple-300">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Pitch de Ventas con IA para {activeLeadForPitch?.nombre}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Generado específicamente considerando el rubro ({activeLeadForPitch?.rubro}) y localidad ({activeLeadForPitch?.zona}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {generatingPitch ? (
              <div className="py-8 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-400" />
                <p className="text-xs text-slate-400">Redactando propuesta persuasiva con IA...</p>
              </div>
            ) : (
              <>
                <Textarea
                  value={pitchText}
                  onChange={(e) => setPitchText(e.target.value)}
                  rows={5}
                  className="bg-black/50 border-white/10 text-xs text-slate-200 focus-visible:ring-purple-500 leading-relaxed"
                  placeholder="Mensaje de prospección..."
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{pitchText.length} caracteres</span>
                  <span>Marca activa: <strong className="text-purple-300">{activeBrandName}</strong></span>
                </div>

                {/* Oportunidad de Landing Page Demo */}
                {activeLeadForPitch && !activeLeadForPitch.website && (
                  <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-purple-200">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>
                        Sin web oficial: <strong>Demo {activeBrandName}</strong> lista para ofrecer por WhatsApp.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`/demo/${encodeURIComponent(activeLeadForPitch.place_id)}?brand=${encodeURIComponent(activeBrandName)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 text-[11px] font-semibold flex items-center gap-1 border border-purple-500/30"
                      >
                        <ExternalLink className="w-3 h-3" /> Previsualizar
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const origin = typeof window !== "undefined" ? window.location.origin : "";
                          const demoUrl = `${origin}/demo/${encodeURIComponent(activeLeadForPitch.place_id)}?brand=${encodeURIComponent(activeBrandName)}`;
                          const dynamicPitch = `Hola ${activeLeadForPitch.nombre} 👋 Vi que en Google Maps aún no tenían sitio web oficial.

Desde ${activeBrandName} les armamos esta demo interactiva en vivo para que vean cómo luciría su catálogo y cómo recibir consultas directas a este WhatsApp:
${demoUrl}

¿Tienen 5 minutos para ver cómo activarla con su propio dominio esta misma semana?`;
                          setPitchText(dynamicPitch);
                          toast.success(`Pitch de ${activeBrandName} cargado con enlace a la Landing Demo`);
                        }}
                        className="h-7 text-[11px] border-purple-500/50 bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                      >
                        Insertar Demo {activeBrandName}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveLeadForPitch(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </Button>
              {activeLeadForPitch?.telefono && (
                <a
                  href={`https://wa.me/${activeLeadForPitch.telefono.replace(/[^\d]/g, "")}?text=${encodeURIComponent(pitchText)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleSaveCustomPitch}
                  className="h-8 px-3 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Enviar por WhatsApp
                </a>
              )}
              <Button
                size="sm"
                onClick={handleSaveCustomPitch}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs"
              >
                Guardar Pitch
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuración Google Places API Key */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="bg-[#0f0f18] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-cyan-300">
              <Key className="w-5 h-5 text-cyan-400" />
              Configurar Google Places API
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Conecta tu clave de Google Cloud Console para acceder a la base oficial de Google Maps con teléfonos, puntuaciones y sitios web verificados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {googleConfig.configured && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                <span className="text-emerald-300 font-medium flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Clave actual: <code className="font-mono bg-black/40 px-1.5 py-0.5 rounded">{googleConfig.maskedKey}</code>
                </span>
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                  Activa
                </Badge>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                {googleConfig.configured ? "Reemplazar Google Places API Key" : "Ingresar Google Places API Key"}
              </label>
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="bg-black/50 border-white/10 text-white text-sm font-mono focus-visible:ring-cyan-500"
              />
              <p className="text-[11px] text-slate-400 leading-normal">
                Esta clave se almacena de forma segura en tu archivo de entorno local (<code className="text-slate-300">.env</code>) y en memoria para que puedas escanear sin reiniciar la aplicación.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[11px] text-cyan-200/80 space-y-1">
              <p className="font-semibold text-cyan-300 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" /> ¿No quieres usar tarjeta ni crear API Key?
              </p>
              <p>
                Puedes usar en cualquier momento el motor <strong>OpenStreetMap</strong>, que es 100% libre, gratuito y ya está funcionando sin necesidad de configurar nada.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveGoogleKey}
                disabled={savingKey || !apiKeyInput.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
              >
                {savingKey ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5 mr-1.5" />
                    Guardar y Activar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Limpieza de Lista / Reset CRM */}
      {/* Análisis de oportunidad: solo analiza, nunca contacta */}
      <Dialog
        open={!!analysisLead}
        onOpenChange={(open) => !open && setAnalysisLead(null)}
      >
        <DialogContent className="bg-[#0e0e18] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-300">
              <Compass className="w-4 h-4 text-emerald-400" />
              Análisis de oportunidad de {analysisLead?.nombre}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Solo análisis: no envía mensajes, no publica y no contacta al
              comercio. Contactar sigue siendo una acción manual y separada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto pr-1 text-xs">
            {analyzingId && !analysisResult && (
              <div className="py-10 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
                <p className="text-slate-400">
                  Enriqueciendo datos, clasificando y analizando la oportunidad...
                </p>
              </div>
            )}

            {analysisError && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">
                {analysisError}
              </div>
            )}

            {analysisResult && (
              <>
                <section className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Datos del negocio
                  </h4>
                  <p className="text-slate-300">
                    {analysisResult.signals?.business.name || analysisLead?.nombre} ·{" "}
                    {analysisResult.signals?.business.category || analysisLead?.rubro} ·{" "}
                    {analysisResult.signals?.business.zone || analysisLead?.zona}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Contactable: {analysisResult.signals?.contactable ? "sí" : "no"} ·
                    Sitio web:{" "}
                    {analysisResult.signals?.website.present
                      ? "sí"
                      : analysisResult.signals?.website.status === "not_found"
                        ? "no encontrado en las fuentes consultadas"
                        : "no se buscó"}
                  </p>
                </section>

                <section className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Evidencias encontradas
                  </h4>
                  {analysisResult.evidence.length === 0 ? (
                    <p className="text-slate-500">Sin evidencia registrada todavía.</p>
                  ) : (
                    <ul className="space-y-1">
                      {analysisResult.evidence.map((item, index) => (
                        <li
                          key={item.field + "-" + item.status + "-" + index}
                          className="flex items-start gap-2"
                        >
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 bg-white/[0.03] border-white/10 text-slate-300 shrink-0"
                          >
                            {item.status}
                          </Badge>
                          <span className="text-slate-300">
                            <strong className="text-slate-200">{item.field}</strong>
                            {item.value ? ": " + String(item.value).slice(0, 70) : ""}
                            <span className="text-slate-500">
                              {" · "}
                              {item.source}
                              {item.sourceUrl
                                ? " · " + item.sourceUrl.slice(0, 60)
                                : ""}
                              {" · confianza "}
                              {item.confidence}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Fuentes consultadas
                  </h4>
                  <p className="text-slate-400">
                    {(analysisResult.signals?.consultedSources || []).join(", ") ||
                      "sin fuentes registradas"}
                  </p>
                  {analysisResult.enrichment.checkedUrls.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      URLs revisadas: {analysisResult.enrichment.checkedUrls.join(", ")}
                    </p>
                  )}
                </section>

                <section className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Resultado Jev (clasificador rápido)
                  </h4>
                  {analysisResult.jev ? (
                    analysisResult.jev.ok ? (
                      <p className="text-slate-300">
                        Ruteo:{" "}
                        <strong className="text-emerald-300">
                          {analysisResult.jev.routing}
                        </strong>{" "}
                        · modelo {analysisResult.jev.model} ·{" "}
                        {analysisResult.jev.latencyMs} ms
                        {analysisResult.jev.primaryGap
                          ? " · brecha principal: " + analysisResult.jev.primaryGap.choice
                          : ""}
                        <br />
                        <span className="text-[11px] text-slate-500">
                          {analysisResult.jev.routingReason}
                        </span>
                      </p>
                    ) : (
                      <p className="text-amber-200">{analysisResult.jev.error}</p>
                    )
                  ) : (
                    <p className="text-slate-500">
                      Jev no se ejecutó en este análisis.
                    </p>
                  )}
                </section>

                <section className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Análisis DeepSeek
                  </h4>
                  {analysisResult.analysis?.ok ? (
                    <p className="text-slate-300">
                      Modelo {analysisResult.analysis.model} ·{" "}
                      {analysisResult.analysis.latencyMs} ms · cobertura de evidencia{" "}
                      {analysisResult.analysis.evidenceCoverage.supported}/
                      {analysisResult.analysis.evidenceCoverage.total} (
                      {analysisResult.analysis.evidenceCoverage.score})
                      <br />
                      <span className="text-[11px] text-slate-500">
                        Campos citados:{" "}
                        {analysisResult.analysis.evidenceUsed.join(", ") || "ninguno"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-amber-200">
                      {analysisResult.analysis?.error || "No se ejecutó el análisis."}
                    </p>
                  )}
                </section>

                <section className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Oportunidad detectada
                  </h4>
                  {analysisResult.analysis?.opportunityDetected ? (
                    <p className="text-slate-300">
                      <strong className="text-emerald-300">
                        {analysisResult.analysis.opportunityType || "oportunidad"}
                      </strong>
                      {analysisResult.analysis.problemDetected
                        ? " · " + analysisResult.analysis.problemDetected
                        : ""}
                    </p>
                  ) : (
                    <p className="text-slate-400">
                      No se detectó una oportunidad suficientemente clara.
                      {analysisResult.analysis?.problemDetected
                        ? " " + analysisResult.analysis.problemDetected
                        : ""}
                    </p>
                  )}
                </section>

                <section className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Solución propuesta
                  </h4>
                  <p className="text-slate-300">
                    {analysisResult.analysis?.proposedSolution || "Sin propuesta."}
                  </p>
                  {analysisResult.analysis?.recommendedProducts?.length ? (
                    <p className="text-[11px] text-slate-500">
                      Productos sugeridos:{" "}
                      {analysisResult.analysis.recommendedProducts.join(", ")}
                    </p>
                  ) : null}
                  {analysisResult.analysis?.reasoning && (
                    <p className="text-[11px] text-slate-500">
                      Razonamiento: {analysisResult.analysis.reasoning}
                    </p>
                  )}
                </section>

                <p className="text-[10px] text-slate-600">
                  Análisis {analysisResult.logId || "sin id"} ·{" "}
                  {analysisResult.durationMs} ms · etapa final{" "}
                  {analysisResult.stage}
                </p>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
            <span className="text-[10px] text-slate-500 mr-auto">
              Analizar no es contactar: el envío sigue siendo manual.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAnalysisLead(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isClearModalOpen} onOpenChange={setIsClearModalOpen}>
        <DialogContent className="bg-[#0f0f18] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5 text-red-400" />
              Gestionar y Limpiar Prospectos
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Elige cómo deseas limpiar la base de prospectos para no acumular resultados innecesarios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-amber-500/30 transition-all flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
                  Limpiar solo prospectos sin contactar
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Elimina los comercios escaneados que siguen en estado <strong>Nuevo</strong>, protegiendo tus clientes cerrados, demos agendadas y mensajes enviados.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={clearingLeads}
                onClick={() => handleClearLeads("onlyNew")}
                className="shrink-0 h-8 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              >
                Limpiar Nuevos
              </Button>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-red-500/30 transition-all flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  Vaciar completamente toda la lista
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Borra todos los prospectos de la base actual para dejar el CRM completamente en cero.
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={clearingLeads}
                onClick={() => handleClearLeads("all")}
                className="shrink-0 h-8 text-xs bg-red-600/80 hover:bg-red-600 font-semibold"
              >
                Vaciar Todo
              </Button>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-white/[0.08]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsClearModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
