import { LeadItem } from "./leads-service";

export interface ServiceItem {
  title: string;
  desc: string;
  icon: string; // lucide icon identifier
}

export interface TestimonialItem {
  name: string;
  role: string;
  comment: string;
  stars: number;
}

export interface LandingTemplateData {
  badge: string;
  heroHeadline: string;
  heroSubheadline: string;
  ctaText: string;
  secondaryCtaText: string;
  accentColor: string;
  gradient: string;
  services: ServiceItem[];
  benefits: { title: string; desc: string }[];
  testimonials: TestimonialItem[];
  faqs: { q: string; a: string }[];
}

export function getLandingTemplate(lead: LeadItem): LandingTemplateData {
  const rubroLower = (lead.rubro || "").toLowerCase();
  const nombre = lead.nombre || "Tu Comercio";
  const zona = lead.zona || "tu localidad";

  // 1. Gimnasio / Fitness / Crossfit
  if (rubroLower.includes("gimnas") || rubroLower.includes("gym") || rubroLower.includes("fitness") || rubroLower.includes("entrenam")) {
    return {
      badge: "💪 Centro de Entrenamiento & Salud",
      heroHeadline: `Transformá tu cuerpo y salud en ${nombre}`,
      heroSubheadline: `Entrenamiento personalizado, máquinas de última generación y los mejores planes en ${zona}. Sumate hoy a nuestra comunidad.`,
      ctaText: "Consultar Planes por WhatsApp",
      secondaryCtaText: "Reservar Clase de Prueba",
      accentColor: "#10b981",
      gradient: "from-emerald-600 via-teal-600 to-cyan-700",
      services: [
        { title: "Musculación & Cardio", desc: "Equipamiento biomecánico completo para rutinas de fuerza y resistencia.", icon: "Dumbbell" },
        { title: "Entrenamiento Funcional", desc: "Clases grupales dinámicas orientadas a quemar calorías y ganar agilidad.", icon: "Activity" },
        { title: "Planes Personalizados", desc: "Seguimiento individual de objetivos, peso y progreso físico semana a semana.", icon: "TrendingUp" },
        { title: "Asesoramiento Nutricional", desc: "Guía de hábitos saludables para potenciar tus resultados en el gimnasio.", icon: "Heart" },
      ],
      benefits: [
        { title: "Ambiente Motivador", desc: "Comunidad enfocada en el progreso constante y la salud integral." },
        { title: "Profesores Certificados", desc: "Instructores atentos a tu técnica y cuidado postural en cada ejercicio." },
        { title: "Horarios Flexibles", desc: "Abierto de lunes a sábados para que entrenes a tu propio ritmo." },
      ],
      testimonials: [
        { name: "Lucas M.", role: "Socio hace 8 meses", comment: `El mejor ambiente de ${zona}. Los profes están siempre atentos y las máquinas impecables.`, stars: 5 },
        { name: "Florencia G.", role: "Socia activa", comment: "Empecé sin experiencia y hoy no cambio mi rutina por nada. Súper recomendado.", stars: 5 },
      ],
      faqs: [
        { q: "¿Tienen clase de prueba?", a: "¡Sí! Podés coordinar una clase de bienvenida gratuita escribiéndonos directamente por WhatsApp." },
        { q: "¿Qué formas de pago aceptan?", a: "Aceptamos efectivo, transferencias bancarias y tarjetas de débito/crédito con planes mensuales y trimestrales." },
      ],
    };
  }

  // 2. Taller Mecánico / Chapa y Pintura / Neumáticos
  if (rubroLower.includes("taller") || rubroLower.includes("mecanic") || rubroLower.includes("auto") || rubroLower.includes("frenos")) {
    return {
      badge: "🔧 Servicio Mecánico de Confianza",
      heroHeadline: `Cuidado integral y diagnóstico de precisión en ${nombre}`,
      heroSubheadline: `Mantenimiento preventivo, mecánica general y scanner computarizado en ${zona}. Tu vehículo en manos de especialistas.`,
      ctaText: "Pedir Presupuesto por WhatsApp",
      secondaryCtaText: "Coordinar Turno de Taller",
      accentColor: "#f59e0b",
      gradient: "from-amber-600 via-orange-600 to-red-600",
      services: [
        { title: "Diagnóstico Computarizado", desc: "Detección rápida de fallas electrónicas y chequeo de sensores de motor.", icon: "Cpu" },
        { title: "Frenos, Suspensión y Tren Delantero", desc: "Reparación y cambio de pastillas, amortiguadores y bujes para tu seguridad.", icon: "Shield" },
        { title: "Service de Aceite y Filtros", desc: "Mantenimiento periódico con fluidos originales y filtros de primera calidad.", icon: "Wrench" },
        { title: "Distribución y Embragues", desc: "Reemplazo de correas, tensores y kits completos con repuestos garantizados.", icon: "Cog" },
      ],
      benefits: [
        { title: "Presupuestos Claros", desc: "Sin sorpresas. Te informamos el detalle de piezas y mano de obra antes de arrancar." },
        { title: "Garantía en Trabajos", desc: "Repuestos certificados y respaldo técnico en cada reparación realizada." },
        { title: "Rapidez y Cumplimiento", desc: "Compromiso de entrega en los plazos pactados para que no te quedes a pie." },
      ],
      testimonials: [
        { name: "Gonzalo P.", role: "Cliente particular", comment: `Excelente atención en ${nombre}. Me explicaron todo con claridad y el auto quedó perfecto.`, stars: 5 },
        { name: "Mariano R.", role: "Cliente habitual", comment: "Honestos, rápidos y muy profesionales. Dejé el auto por un service y me lo entregaron en el día.", stars: 5 },
      ],
      faqs: [
        { q: "¿Hacen presupuestos sin cargo?", a: "Sí, traé tu vehículo o envianos fotos/detalles por WhatsApp para una cotización previa." },
        { q: "¿Trabajan con todas las marcas?", a: "Atendemos la gran mayoría de marcas y modelos nacionales e importados." },
      ],
    };
  }

  // 3. Ferretería / Corralón / Pinturería
  if (rubroLower.includes("ferreter") || rubroLower.includes("corralon") || rubroLower.includes("pintur") || rubroLower.includes("herramient")) {
    return {
      badge: "🔨 Materiales, Herramientas & Construcción",
      heroHeadline: `Todo lo que necesitás para tu obra y hogar en ${nombre}`,
      heroSubheadline: `El catálogo más completo de herramientas, bulonería, electricidad y plomería en ${zona}. Asesoramiento técnico personalizado.`,
      ctaText: "Consultar Stock & Precios por WhatsApp",
      secondaryCtaText: "Enviar Lista de Materiales",
      accentColor: "#3b82f6",
      gradient: "from-blue-600 via-indigo-600 to-cyan-600",
      services: [
        { title: "Herramientas Eléctricas & Manuales", desc: "Primeras marcas para profesionales de la construcción y aficionados del bricolaje.", icon: "Wrench" },
        { title: "Plomería, Gas y Sanitarios", desc: "Caños, griferías, repuestos y accesorios de primeras marcas garantizadas.", icon: "Droplet" },
        { title: "Electricidad e Iluminación", desc: "Cables, térmicas, lámparas LED y materiales para instalaciones seguras.", icon: "Zap" },
        { title: "Pinturas & Selladores", desc: "Látex, esmaltes sintéticos, impermeabilizantes y accesorios para renovar tus espacios.", icon: "Paintbrush" },
      ],
      benefits: [
        { title: "Stock Permanente", desc: "Variedad de artículos para que encuentres lo que buscás sin dar vueltas." },
        { title: "Asesoramiento Experto", desc: "Te orientamos con la mejor solución técnica para tu proyecto o arreglo hogareño." },
        { title: "Envíos a Domicilio", desc: "Hacemos envíos rápidos en ${zona} para compras de volumen o paquetes pesados." },
      ],
      testimonials: [
        { name: "Esteban D.", role: "Contratista", comment: `Siempre tienen lo que busco. Compro materiales para mis obras en ${nombre} desde hace años.`, stars: 5 },
        { name: "Valeria C.", role: "Vecina de la zona", comment: "Excelente atención al cliente. Me ayudaron a elegir exactamente la pieza que necesitaba.", stars: 5 },
      ],
      faqs: [
        { q: "¿Hacen envíos a domicilio?", a: `Sí, coordinamos entregas en ${zona} para pedidos directos por WhatsApp.` },
        { q: "¿Tienen venta mayorista?", a: "Sí, tenemos precios especiales por volumen para profesionales y constructoras." },
      ],
    };
  }

  // 4. Inmobiliaria / Bienes Raíces
  if (rubroLower.includes("inmob") || rubroLower.includes("propiedad") || rubroLower.includes("alquiler") || rubroLower.includes("bienes")) {
    return {
      badge: "🏡 Bienes Raíces & Asesoramiento Inmobiliario",
      heroHeadline: `Encontrá tu próximo hogar o inversión con ${nombre}`,
      heroSubheadline: `Venta, alquiler y tasaciones profesionales en ${zona}. Gestión transparente y acompañamiento en cada paso.`,
      ctaText: "Consultar Propiedades Disponibles",
      secondaryCtaText: "Solicitar Tasación",
      accentColor: "#6366f1",
      gradient: "from-indigo-600 via-purple-600 to-pink-600",
      services: [
        { title: "Venta de Propiedades", desc: "Casas, departamentos y lotes seleccionados con documentación verificada.", icon: "Home" },
        { title: "Alquileres Residenciales & Comerciales", desc: "Opciones seguras para familias y empresas con contratos claros.", icon: "Key" },
        { title: "Tasaciones Profesionales", desc: "Valuación real de mercado para maximizar el valor de tu propiedad.", icon: "FileText" },
        { title: "Asesoría Legal e Inversiones", desc: "Acompañamiento en escrituras, boletos y análisis de rentabilidad.", icon: "Briefcase" },
      ],
      benefits: [
        { title: "Amplia Red de Contactos", desc: "Conectamos compradores y vendedores calificados rápidamente." },
        { title: "Atención Cercana", desc: "Trato personalizado y seguimiento constante hasta la firma final." },
        { title: "Conocimiento de la Zona", desc: `Expertos en el mercado inmobiliario de ${zona} y alrededores.` },
      ],
      testimonials: [
        { name: "Carolina B.", role: "Compradora", comment: `La gestión de ${nombre} fue impecable. Nos encontraron el departamento soñado sin complicaciones.`, stars: 5 },
        { name: "Javier T.", role: "Propietario", comment: "Tasaron y vendieron mi propiedad en tiempo récord. Totalmente confiables.", stars: 5 },
      ],
      faqs: [
        { q: "¿Cómo solicito una tasación?", a: "Escribinos por WhatsApp y coordinamos una visita técnica para evaluar tu propiedad." },
        { q: "¿Qué requisitos piden para alquilar?", a: "Trabajamos con garantías propietarias y seguros de caución de primera línea." },
      ],
    };
  }

  // 5. Restaurante / Gastronomía / Cafetería
  if (rubroLower.includes("restauran") || rubroLower.includes("cafe") || rubroLower.includes("comida") || rubroLower.includes("pizza") || rubroLower.includes("bar")) {
    return {
      badge: "🍽️ Sabores Auténticos & Gastronomía",
      heroHeadline: `Vivi una experiencia gastronómica única en ${nombre}`,
      heroSubheadline: `Platos elaborados con ingredientes frescos, el mejor ambiente y delivery express en ${zona}.`,
      ctaText: "Hacer Pedido por WhatsApp",
      secondaryCtaText: "Reservar Mesa",
      accentColor: "#ef4444",
      gradient: "from-red-600 via-rose-600 to-amber-600",
      services: [
        { title: "Platos Especiales del Chef", desc: "Recetas exclusivas preparadas en el momento con ingredientes de calidad.", icon: "Utensils" },
        { title: "Delivery Rápido & Take Away", desc: "Empaques térmicos para que recibas tu comida caliente y lista para disfrutar.", icon: "ShoppingBag" },
        { title: "Eventos & Reservas", desc: "Espacio acondicionado para celebrar cumpleaños, reuniones y cenas de amigos.", icon: "Users" },
        { title: "Carta de Bebidas & Postres", desc: "Cafetería de especialidad, tragos clásicos y repostería artesanal.", icon: "Coffee" },
      ],
      benefits: [
        { title: "Ingredientes Frescos", desc: "Selección diaria de materias primas para garantizar sabor y frescura." },
        { title: "Ambiente Cálido", desc: "Música, atención amable y un espacio pensado para que te sientas como en casa." },
        { title: "Rapidez en el Servicio", desc: "Tanto en salón como en delivery cuidamos los tiempos de entrega." },
      ],
      testimonials: [
        { name: "Luciana S.", role: "Clienta frecuente", comment: `La comida de ${nombre} es exquisita. El delivery llega volando y siempre caliente.`, stars: 5 },
        { name: "Pablo M.", role: "Cena familiar", comment: "Festejamos un aniversario y la pasamos bárbaro. Excelente servicio y porciones generosas.", stars: 5 },
      ],
      faqs: [
        { q: "¿Hacen delivery?", a: `Sí, cubrimos toda la zona de ${zona}. Podés ver el menú completo y pedir por WhatsApp.` },
        { q: "¿Se puede reservar con anticipación?", a: "¡Claro! Avisanos la cantidad de personas y el horario para guardarte una mesa." },
      ],
    };
  }

  // 6. Rubro General / Comercio de Proximidad
  return {
    badge: `✨ Calidad & Confianza en ${zona}`,
    heroHeadline: `Tu mejor opción en ${lead.rubro || "servicios"}: ${nombre}`,
    heroSubheadline: `Atención personalizada, soluciones inmediatas y el respaldo que buscás en ${zona}. Contactanos hoy mismo.`,
    ctaText: "Escribinos por WhatsApp",
    secondaryCtaText: "Ver Nuestros Servicios",
    accentColor: "#8b5cf6",
    gradient: "from-purple-600 via-violet-600 to-indigo-600",
    services: [
      { title: "Atención Personalizada", desc: "Escuchamos lo que necesitás y te brindamos una solución a tu medida.", icon: "CheckCircle" },
      { title: "Calidad Garantizada", desc: "Trabajamos con los mejores estándares para asegurar tu completa satisfacción.", icon: "Star" },
      { title: "Respuesta Rápida", desc: "Canal directo de contacto para resolver dudas y consultas en minutos.", icon: "Zap" },
      { title: "Presupuestos a Medida", desc: "Opciones competitivas adaptadas a tus necesidades y presupuesto.", icon: "DollarSign" },
    ],
    benefits: [
      { title: "Trayectoria Local", desc: `Años de compromiso y clientes satisfechos en la zona de ${zona}.` },
      { title: "Cercanía y Confianza", desc: "Un equipo dispuesto a ayudarte con la mejor disposición y profesionalismo." },
      { title: "Facilidades de Contacto", desc: "Escribinos directamente a nuestro WhatsApp oficial para atención inmediata." },
    ],
    testimonials: [
      { name: "Martín R.", role: "Cliente", comment: `Excelente servicio en ${nombre}. Muy atentos y resolvieron todo con rapidez.`, stars: 5 },
      { name: "Romina L.", role: "Clienta", comment: "Súper recomendables. Da gusto encontrar negocios que atiendan tan bien.", stars: 5 },
    ],
    faqs: [
      { q: "¿Cómo puedo solicitar más información?", a: "Escribinos un mensaje a nuestro WhatsApp y te respondemos a la brevedad." },
      { q: "¿Dónde están ubicados?", a: lead.direccion ? `Nos encontramos en ${lead.direccion}.` : `Estamos en ${zona}.` },
    ],
  };
}
