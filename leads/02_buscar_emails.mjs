#!/usr/bin/env node
// 02_buscar_emails.mjs — Descubre emails de contacto en las webs de los leads
// Uso: node 02_buscar_emails.mjs [--limite 100]
// Salida: data/leads_email.csv (añade columna email)
import fs from "fs";
import { DATA_DIR } from "./config.mjs";

fs.mkdirSync(DATA_DIR, { recursive: true });
const LIMITE = parseInt(process.argv[2] || "200", 10);
const TIMEOUT = 8000;
const RE_MAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const RE_CHAT = /^[\s\S]*$/; // filtro de basura abajo
const BASURA = ["png", "jpg", "jpeg", "gif", "webp", "svg", "example", "sentry", "wixpress", "godaddy", "domain.com", ".png", "@2x", "sentry.io", "email.com", "your@", "name@", "mail@mail"];

function leerLeads() {
  const p = DATA_DIR + "leads.csv";
  if (!fs.existsSync(p)) { console.error("Primero corré 01_buscar_maps.mjs"); process.exit(1); }
  const [header, ...filas] = fs.readFileSync(p, "utf8").replace(/^\ufeff/, "").trim().split("\n");
  const idx = header.split(",").map((h) => h.replace(/"/g, ""));
  return filas.map((f) => {
    const o = {}; const cols = f.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    idx.forEach((h, i) => { o[h] = (cols[i] || "").replace(/^"|"$/g, "").replace(/""/g, '"'); });
    return o;
  });
}

function limpiar(emails) {
  const vistos = new Set();
  for (const e of emails) {
    const m = e.trim().toLowerCase();
    if (!m || m.length > 80) continue;
    if (BASURA.some((b) => m.includes(b))) continue;
    if (!m.includes(".")) continue;
    vistos.add(m);
  }
  return [...vistos];
}

async function fetchText(url) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT);
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; LeadFinder/1.0)" } });
    clearTimeout(t);
    if (!r.ok) return "";
    return (await r.text()).slice(0, 400000);
  } catch { return ""; }
}

const rutasExtra = ["/contacto", "/contact", "/contacto/", "/pages/contacto", "/es/contacto"];

(async () => {
  const leads = leerLeads().filter((l) => l.website).slice(0, LIMITE);
  console.log(`Revisando ${leads.length} webs…`);
  let conEmail = 0;
  for (const l of leads) {
    let emails = [];
    let url = l.website.startsWith("http") ? l.website : "https://" + l.website;
    let html = await fetchText(url);
    emails.push(...(html.match(RE_MAIL) || []));
    if (emails.length === 0) {
      for (const extra of rutasExtra) {
        const h = await fetchText(url.replace(/\/$/, "") + extra);
        if (h) { emails.push(...(h.match(RE_MAIL) || [])); if (emails.length) break; }
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    const limpios = limpiar(emails);
    l.email = limpios[0] || "";
    if (l.email) conEmail++;
    console.log(`${conEmail}/${leads.length} con email`.padEnd(22), "-", (l.nombre || "").slice(0, 30), l.email || "(sin email)");
    await new Promise((r) => setTimeout(r, 700)); // cortesía a los sitios
  }
  const csv = [
    "nombre,rubro,zona,direccion,telefono,website,email,rating,types",
    ...leads.map((l) =>
      [l.nombre, l.rubro, l.zona, l.direccion, l.telefono, l.website, l.email, l.rating, l.types]
        .map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
  fs.writeFileSync(DATA_DIR + "leads_email.csv", "\ufeff" + csv, "utf8");
  console.log(`\nEmails encontrados: ${conEmail}/${leads.length} → data/leads_email.csv`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
