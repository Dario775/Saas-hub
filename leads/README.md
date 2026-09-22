# Prospección Obsidiana — Google Maps → WhatsApp + Email

Pipeline para contactar comercios (rubros × zonas) encontrados en Google Maps,
enviarles oferta por WhatsApp (link wa.me) y email (Brevo).

## Setup
1. Copie `.env.example` a `.env` y complete:
   - `GOOGLE_PLACES_KEY` → console.cloud.google.com → crear proyecto →
     habilitar **Places API** → Credenciales → Crear API Key.
   - `BREVO_API_KEY` (opcional) → brevo.com (plan gratis: 300 emails/día) →
     verificar dominio/remitente.
2. Edite `config.mjs` (rubros, zonas, mensajes, oferta).
   Las claves se cargan solas desde `.env` — solo pegue su key y ejecute.

## Uso
```bash
node 01_buscar_maps.mjs                    # 1) busca leads → data/leads.csv
node 02_buscar_emails.mjs --limite 200     # 2) emails desde las webs → leads_email.csv
node 03_whatsapp.mjs                       # 3) mensajes + links wa.me → whatsapp_outreach.csv
node 04_email.mjs --dry                    # 4a) previsualizar emails
node 04_email.mjs --enviar --limite 50     # 4b) enviar (ritmo suave)
```

## Costos reales
- Google Places: ~USD 5–15 por campaña de miles de resultados (Text Search).
- Brevo: gratis 300 emails/día (plan free).
- WhatsApp: $0 en el MVP (envío semimanual con links wa.me).
  Escala posterior: WhatsApp Cloud API oficial (mensajes template).

## Reglas de oro (cumplimiento y entregabilidad)
1. **Solo negocios, nunca particulares.** Respetar la Ley 25.326 (datos personales):
   usar datos de contacto comerciales publicados, con oferta legítima y opt-out.
2. Email: enviar desde dominio verificado (SPF/DKIM) — NO desde obsidiana.com.ar
   sin configurar; volumen bajo y gradual; responder "BAJA" = sacar de la lista.
3. WhatsApp: no automatizar con bots no oficiales (riesgo de baneo del número).
   El CSV genera el mensaje y el link; el envío se hace desde WhatsApp Web.
4. Anotar resultados (respondió/demo/cliente) en el CSV para hacer seguimiento.

## Seguimiento
Agregue columnas: estado (nuevo/contactado/respondio/demo/cliente/no), notas, fecha.
Objetivo de referencia: 100 contactos → ~30 respuestas → 10 demos → 3–5 clientes.
