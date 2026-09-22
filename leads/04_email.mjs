#!/usr/bin/env node
// 04_email.mjs — Envía la oferta por email vía Brevo (transaccional).
// Uso: node 04_email.mjs --dry           (solo muestra, no envía)
//      node 04_email.mjs --enviar        (envía de a 1, pausa entre envíos)
//      node 04_email.mjs --enviar --limite 50
// Requiere: BREVO_API_KEY, EMAIL_FROM (nombre+email verificado en Brevo)
import fs from "fs";
import { EMAIL_ASUNTO, EMAIL_CUERPO, DATA_DIR } from "./config.mjs";
import { loadEnv } from "./env.mjs";
loadEnv();

const MODE = process.argv.includes("--enviar") ? "send" : "dry";
const LIMITE = (() => { const i = process.argv.indexOf("--limite"); return i > -1 ? parseInt(process.argv[i + 1], 10) : 100; })();
const KEY = process.env.BREVO_API_KEY;
const FROM = process.env.EMAIL_FROM || "";

fs.mkdirSync(DATA_DIR, { recursive: true });
const archivo = fs.existsSync(DATA_DIR + "leads_email.csv") ? "leads_email.csv" : "leads.csv";
const [header, ...filas] = fs.readFileSync(DATA_DIR + archivo, "utf8").replace(/^\ufeff/, "").trim().split("\n");
const idx = header.split(",").map((h) => h.replace(/"/g, ""));
const leads = filas.map((f) => {
  const o = {}; const cols = f.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  idx.forEach((h, i) => { o[h] = (cols[i] || "").replace(/^"|"$/g, "").replace(/""/g, '"'); });
  return o;
}).filter((l) => l.email).slice(0, LIMITE);

function personalizar(txt, l) {
  return txt
    .replaceAll("{negocio}", l.nombre || "su comercio")
    .replaceAll("{rubro}", l.rubro || "")
    .replaceAll("{zona}", l.zona || "");
}

if (MODE === "send" && (!KEY || !FROM)) {
  console.error("Falta BREVO_API_KEY o EMAIL_FROM (ver .env.example). Abortado.");
  process.exit(1);
}

async function enviar(l, html) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Obsidiana", email: FROM },
      to: [{ email: l.email, name: l.nombre }],
      subject: personalizar(EMAIL_ASUNTO, l),
      htmlContent: html,
      textContent: personalizar(EMAIL_CUERPO, l) + "\n\nSi no desea recibir más mensajes: responda BAJA.",
    }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? true : `ERROR ${r.status} ${JSON.stringify(j).slice(0, 200)}`;
}

(async () => {
  if (leads.length === 0) { console.log("No hay leads con email."); return; }
  console.log(`Modo: ${MODE === "send" ? "ENVIANDO" : "PRUEBA (dry)"} | ${leads.length} emails`);
  let ok = 0, fail = 0;
  for (const l of leads) {
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <p>${personalizar(EMAIL_CUERPO, l).replace(/\n/g, "<br/>").replace(/\*\*/g, "")}</p>
      <hr/><p style="color:#888;font-size:11px">Obsidiana — obsidiana.com.ar · Para no recibir más mensajes responda BAJA.</p></div>`;
    if (MODE === "send") {
      const res = await enviar(l, html);
      if (res === true) { ok++; console.log(`✓ ${l.email}`); }
      else { fail++; console.log(`✗ ${l.email} — ${res}`); }
      await new Promise((r) => setTimeout(r, 2500)); // ritmo suave (≈34/min, muy por debajo de límites)
    } else {
      console.log(`\nTO: ${l.email} (${l.nombre})\nSUBJECT: ${personalizar(EMAIL_ASUNTO, l)}\nBODY: ${personalizar(EMAIL_CUERPO, l).slice(0, 180)}…`);
    }
  }
  if (MODE === "send") console.log(`\nEnviados OK: ${ok} | Fallos: ${fail}`);
  else console.log(`\nModo prueba: nada enviado. Use --enviar para mandar (${leads.length} emails).`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
