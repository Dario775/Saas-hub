import { brandMark, footer, header, text, type FlyerTemplate } from "./template";

const BODY = { key: "cuerpo", label: "Qué hace la marca, en una oración", kind: "text", max: 90 } as const;
const LABEL = { key: "etiqueta", label: "Etiqueta breve del tema", kind: "text", max: 28, optional: true } as const;

/** Foto editorial a sangre con titular en dos líneas. */
export const foto: FlyerTemplate = {
  id: "foto",
  name: "Foto editorial",
  purpose:
    "Oficio, detalle o materia: una foto macro o documental potente (manos trabajando, herramienta, textura). Nunca personas posando, oficinas ni salas de servidores.",
  asset: "foto",
  assetGuide:
    "editorial documentary photograph, extreme close-up or macro, single strong light source, very shallow depth of field, main subject strictly in the lower half of the frame, the entire upper half plain and dark for a headline, authentic texture, subtle film grain, no text, no letters, no logos",
  tones: ["oscuro"],
  slots: [LABEL, { key: "linea", label: "Titular, primera línea", kind: "text", max: 20 }, { key: "destacado", label: "Titular, segunda línea destacada", kind: "text", max: 20 }, BODY],
  render(context) {
    return {
      css: `body{background:#050607;color:#fff}.photo{background:url('${context.assetUrl || ""}') center bottom/cover no-repeat}
.shade{background:linear-gradient(180deg,rgba(3,5,6,.9) 0%,rgba(3,5,6,.55) 38%,rgba(3,5,6,0) 58%,rgba(3,5,6,0) 74%,rgba(3,5,6,.88) 100%)}
h1{font-size:158px;line-height:.93;letter-spacing:-.04em;font-weight:600;white-space:nowrap}h1 em{font-style:normal;color:${context.theme.accent}}`,
      body: `<div class="fill photo"></div><div class="fill shade"></div><div class="page"><header>${brandMark(context, context.logoLightUrl)}<span class="label">${text(context, "etiqueta")}</span></header><h1 data-fit="0.3">${text(context, "linea")}<br><em>${text(context, "destacado")}</em></h1><main></main>${footer(context, text(context, "cuerpo"))}</div>`,
    };
  },
};

/** Objeto recortado que invade la tipografía. */
export const objeto: FlyerTemplate = {
  id: "objeto",
  name: "Objeto",
  purpose: "Producto o metáfora en un solo objeto físico, recortado y grande, que se superpone apenas a dos palabras enormes.",
  asset: "objeto",
  assetGuide:
    "single isolated physical object, premium studio product photograph, three quarter view, floating, dramatic rim light, blank unbranded surfaces, extremely detailed, realistic materials",
  tones: ["acento", "claro", "oscuro"],
  slots: [LABEL, { key: "palabra1", label: "Primera palabra o dos muy cortas", kind: "text", max: 10 }, { key: "palabra2", label: "Segunda palabra", kind: "text", max: 10 }, { ...BODY, max: 70 }],
  render(context) {
    const square = context.height < 1200;
    return {
      css: `.words{font-family:'Inter Tight';font-weight:800;font-size:${square ? 240 : 300}px;line-height:.8;letter-spacing:-.045em;white-space:nowrap;margin-left:-8px}
main{position:relative}.obj{position:absolute;right:-16px;top:${square ? -40 : -56}px;bottom:-30px;width:74%;background:url('${context.assetUrl || ""}') right center/contain no-repeat;filter:drop-shadow(0 54px 42px rgba(0,14,10,.46))}`,
      body: `<div class="page">${header(context, text(context, "etiqueta"))}<div class="words" data-fit="0.42">${text(context, "palabra1")}<br>${text(context, "palabra2")}</div><main><div class="obj"></div></main>${footer(context, text(context, "cuerpo"))}</div>`,
    };
  },
};
