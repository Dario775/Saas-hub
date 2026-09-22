#!/usr/bin/env node
// 01_buscar_maps.mjs — Busca negocios en Google Maps (Places API Text Search)
// Uso: node 01_buscar_maps.mjs            (recorre RUBROS × ZONAS de config)
//      node 01_buscar_maps.mjs "ferretería" "Palermo, Buenos Aires"
// Salida: data/leads.csv + data/leads.json
import fs from "fs";
import { RUBROS, ZONAS, MAX_POR_BUSQUEDA, DATA_DIR } from "./config.mjs";
import { loadEnv } from "./env.mjs";
loadEnv();

const KEY = process.env.GOOGLE_PLACES_KEY;
if (!KEY) {
  console.error("Falta GOOGLE_PLACES_KEY (ver .env.example)");
  process.exit(1);
}
fs.mkdirSync(DATA_DIR, { recursive: true });

const rubros = process.argv[2] ? [process.argv[2]] : RUBROS;
const zonas = process.argv[3] ? [process.argv[3]] : ZONAS;

const URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const leads = new Map(); // dedupe por place_id

async function buscar(query) {
  const u = `${URL}?query=${encodeURIComponent(query)}&key=${KEY}`;
  const r = await fetch(u);
  const j = await r.json();
  if (j.status !== "OK") {
    console.error("  Places:", j.status, j.error_message || "");
    return;
  }
  for (const p of j.results.slice(0, MAX_POR_BUSQUEDA)) {
    if (leads.has(p.place_id)) continue;
    leads.set(p.place_id, {
      nombre: p.name || "",
      rubro: query.split(" en ")[0] || query,
      zona: query.split(" en ")[1] || "",
      direccion: p.formatted_address || "",
      telefono: p.international_phone_number || p.formatted_phone_number || "",
      website: p.website || "",
      rating: p.rating ?? "",
      types: (p.types || []).join("|"),
      place_id: p.place_id,
    });
  }
  console.log(`  ${query}: ${j.results.length} resultados`);
}

(async () => {
  console.log(`Buscando ${rubros.length} rubros × ${zonas.length} zonas…`);
  for (const zona of zonas) {
    for (const rubro of rubros) {
      await buscar(`${rubro} en ${zona}`);
      await new Promise((r) => setTimeout(r, 400)); // cortesía
    }
  }
  const list = [...leads.values()];
  const csv = [
    "nombre,rubro,zona,direccion,telefono,website,rating,types",
    ...list.map((l) =>
      [l.nombre, l.rubro, l.zona, l.direccion, l.telefono, l.website, l.rating, l.types]
        .map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
  fs.writeFileSync(DATA_DIR + "leads.csv", "\ufeff" + csv, "utf8");
  fs.writeFileSync(DATA_DIR + "leads.json", JSON.stringify(list, null, 2), "utf8");
  const conTelf = list.filter((l) => l.telefono).length;
  const conWeb = list.filter((l) => l.website).length;
  console.log(`\nTotal: ${list.length} negocios | con teléfono: ${conTelf} | con web: ${conWeb}`);
  console.log("Archivos: data/leads.csv y data/leads.json");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
