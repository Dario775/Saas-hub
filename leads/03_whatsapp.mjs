#!/usr/bin/env node
// 03_whatsapp.mjs — Genera mensajes + links wa.me personalizados por lead con teléfono
// Uso: node 03_whatsapp.mjs              (usa data/leads_email.csv si existe, si no leads.csv)
// Salida: data/whatsapp_outreach.csv (mensaje listo + link wa.me)
import fs from "fs";
import { WA_MENSAJE, DATA_DIR } from "./config.mjs";

fs.mkdirSync(DATA_DIR, { recursive: true });
const archivo = fs.existsSync(DATA_DIR + "leads_email.csv") ? "leads_email.csv" : "leads.csv";

const [header, ...filas] = fs.readFileSync(DATA_DIR + archivo, "utf8").replace(/^\ufeff/, "").trim().split("\n");
const idx = header.split(",").map((h) => h.replace(/"/g, ""));
const leads = filas.map((f) => {
  const o = {}; const cols = f.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  idx.forEach((h, i) => { o[h] = (cols[i] || "").replace(/^"|"$/g, "").replace(/""/g, '"'); });
  return o;
});

function waDigits(tel) {
  return String(tel || "").replace(/[^\d]/g, "");
}
function personalizar(txt, l) {
  return txt
    .replaceAll("{negocio}", l.nombre || "su negocio")
    .replaceAll("{rubro}", l.rubro || "")
    .replaceAll("{zona}", l.zona || "");
}

const salida = [];
for (const l of leads) {
  const digits = waDigits(l.telefono);
  if (!digits) continue;
  // Argentina: normaliza 54 9 + código sin el 15 inicial si aplica (dejar que WhatsApp resuelva)
  const msg = personalizar(WA_MENSAJE, l);
  const link = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  salida.push({ nombre: l.nombre, rubro: l.rubro, zona: l.zona, telefono: l.telefono, website: l.website, email: l.email || "", mensaje: msg, link });
}

const csv = [
  "nombre,rubro,zona,telefono,website,email,link",
  ...salida.map((s) => [s.nombre, s.rubro, s.zona, s.telefono, s.website, s.email, s.link].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")),
].join("\n");
fs.writeFileSync(DATA_DIR + "whatsapp_outreach.csv", "\ufeff" + csv, "utf8");

// Vista rápida de los primeros links en terminal
console.log(`Leads con WhatsApp: ${salida.length}`);
for (const s of salida.slice(0, 5)) {
  console.log("\n•", s.nombre, "|", s.telefono);
  console.log(" ", s.link.slice(0, 130) + "…");
}
console.log(`\nArchivo completo: data/whatsapp_outreach.csv (abra los links en WhatsApp Web y envíe)`);
