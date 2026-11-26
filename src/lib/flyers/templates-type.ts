import { footer, header, list, text, type FlyerTemplate } from "./template";

const BODY = { key: "cuerpo", label: "Qué hace la marca, en una oración", kind: "text", max: 90 } as const;
const LABEL = { key: "etiqueta", label: "Etiqueta breve del tema", kind: "text", max: 28, optional: true } as const;

/** Solo tipografía: una afirmación que ocupa todo. */
export const afirmacion: FlyerTemplate = {
  id: "afirmacion",
  name: "Afirmación",
  purpose: "Una opinión fuerte o una verdad del rubro. Solo tipografía gigante; funciona si la frase es memorable.",
  asset: null,
  tones: ["claro", "oscuro", "acento"],
  slots: [LABEL, { key: "linea", label: "La frase, hasta la parte destacada", kind: "text", max: 48 }, { key: "destacado", label: "Remate destacado", kind: "text", max: 30 }, BODY],
  render(context) {
    const mark = context.theme.bg === context.theme.accent ? context.theme.paper : context.theme.accent;
    const onMark = context.theme.bg === context.theme.accent ? context.theme.ink : context.theme.onAccent;
    return {
      css: `main{justify-content:center}h1{font-size:${context.height < 1200 ? 170 : 206}px;line-height:.92;letter-spacing:-.045em;text-wrap:wrap}h1 em{font-style:normal;background:${mark};color:${onMark};display:block;width:fit-content;max-width:100%;padding:.06em .16em .12em;margin:.14em 0 0 -.06em;border-radius:.07em}`,
      body: `<div class="page">${header(context, text(context, "etiqueta"))}<main><h1 data-fit="0.62">${text(context, "linea")} <em>${text(context, "destacado")}</em></h1></main>${footer(context, text(context, "cuerpo"))}</div>`,
    };
  },
};

/** Antes y después, en dos mitades. */
export const comparativa: FlyerTemplate = {
  id: "comparativa",
  name: "Comparativa",
  purpose: "Contraste entre cómo trabaja hoy el cliente y cómo podría trabajar. Dos mitades con listas paralelas y concretas.",
  asset: null,
  tones: ["claro", "oscuro"],
  slots: [
    { key: "titular", label: "Titular", kind: "text", max: 40 },
    { key: "antes", label: "Título del lado de hoy", kind: "text", max: 14 },
    { key: "antesItems", label: "Cómo es hoy", kind: "list", max: 34, items: [4, 4] },
    { key: "despues", label: "Título del lado nuevo", kind: "text", max: 14 },
    { key: "despuesItems", label: "Cómo sería, en el mismo orden", kind: "list", max: 34, items: [4, 4] },
    BODY,
  ],
  render(context) {
    const { theme } = context;
    const items = (key: string) => list(context, key).map((item) => `<li>${item}</li>`).join("");
    return {
      css: `h1{font-size:118px}main{flex-direction:row;margin:0 -60px}
.side{flex:1;padding:44px 46px 44px 60px;display:flex;flex-direction:column;background:${theme.dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"}}
.side+.side{background:${theme.accent};color:${theme.onAccent};padding:44px 60px 44px 46px}.side+.side li{border-color:${theme.onAccent}}
.side h2{font-size:34px;font-weight:700;margin-bottom:14px}.side ul{list-style:none;flex:1;display:flex;flex-direction:column;}
.side li{font-size:${context.height < 1200 ? 33 : 41}px;line-height:1.12;font-weight:600;letter-spacing:-.018em;border-top:3px solid ${theme.fg};padding-top:18px;text-wrap:balance;flex:1}
.side:first-child li{text-decoration:line-through;text-decoration-thickness:3px;text-decoration-color:${theme.fg};opacity:.62}`,
      body: `<div class="page">${header(context)}<h1 data-fit="0.19">${text(context, "titular")}</h1><main><section class="side"><h2>${text(context, "antes")}</h2><ul>${items("antesItems")}</ul></section><section class="side"><h2>${text(context, "despues")}</h2><ul>${items("despuesItems")}</ul></section></main>${footer(context, text(context, "cuerpo"))}</div>`,
    };
  },
};

/** Guía breve: contenido útil que se guarda. */
export const pasos: FlyerTemplate = {
  id: "pasos",
  name: "Guía",
  purpose: "Contenido útil para guardar: tres claves, señales o pasos concretos. Educa sin vender de entrada.",
  asset: null,
  tones: ["claro", "oscuro", "acento"],
  slots: [LABEL, { key: "titular", label: "Titular", kind: "text", max: 48 }, { key: "pasos", label: "Tres ideas concretas y completas", kind: "list", max: 62, items: [3, 3] }, BODY],
  render(context) {
    const number = context.theme.bg === context.theme.accent ? context.theme.paper : context.theme.accent;
    return {
      css: `h1{font-size:122px}ol{list-style:none;flex:1;display:flex;flex-direction:column}
li{flex:1;display:flex;align-items:center;gap:44px;border-top:3px solid var(--line)}
li b{font-family:'Inter Tight';font-size:${context.height < 1200 ? 120 : 168}px;line-height:.8;font-weight:800;letter-spacing:-.06em;color:${number};width:130px;flex:none}
li span{font-size:${context.height < 1200 ? 40 : 49}px;line-height:1.1;font-weight:600;letter-spacing:-.02em;text-wrap:balance}`,
      body: `<div class="page">${header(context, text(context, "etiqueta"))}<h1 data-fit="0.25">${text(context, "titular")}</h1><main><ol>${list(context, "pasos").map((step, index) => `<li><b>${index + 1}</b><span>${step}</span></li>`).join("")}</ol></main>${footer(context, text(context, "cuerpo"))}</div>`,
    };
  },
};

/** Oferta con un número protagonista, como un vale. */
export const oferta: FlyerTemplate = {
  id: "oferta",
  name: "Oferta",
  purpose: "Promoción con número, precio o beneficio REAL dado en el pedido. No usar si el pedido no trae una oferta concreta.",
  asset: null,
  tones: ["claro", "oscuro", "acento"],
  slots: [
    { key: "sobre", label: "En qué es la oferta", kind: "text", max: 30 },
    { key: "numero", label: "El número o beneficio (por ejemplo 10%)", kind: "text", max: 8 },
    { key: "detalle", label: "Qué significa", kind: "text", max: 34 },
    { key: "condicion", label: "Vigencia o condición indicada en el pedido", kind: "text", max: 44 },
    BODY,
  ],
  render(context) {
    const { theme } = context;
    const card = theme.bg === theme.accent ? theme.paper : theme.accent;
    const onCard = theme.bg === theme.accent ? theme.ink : theme.onAccent;
    return {
      css: `main{justify-content:center}
.ticket{position:relative;background:${card};color:${onCard};border-radius:34px;padding:54px 58px;flex:1;min-height:0;max-height:860px;display:flex;flex-direction:column;justify-content:space-between}
.ticket:before,.ticket:after{content:"";position:absolute;width:78px;height:78px;border-radius:50%;background:${theme.bg};top:calc(76% - 39px)}.ticket:before{left:-39px}.ticket:after{right:-39px}
.top{height:calc(76% - 80px);display:flex;flex-direction:column;justify-content:space-between}.top h2{font-size:58px;font-weight:600;letter-spacing:-.02em;line-height:1.05}
.num{font-size:430px;font-weight:800;letter-spacing:-.065em;line-height:.74;white-space:nowrap;width:100%}
.low{position:absolute;left:58px;right:58px;top:76%;bottom:0;border-top:5px dashed ${onCard};padding-bottom:44px;display:flex;justify-content:space-between;align-items:flex-end;gap:30px}.low b{font-size:49px;line-height:1.05;letter-spacing:-.02em;font-weight:700}.low span{font-size:29px;font-weight:500;text-align:right;max-width:360px}`,
      body: `<div class="page">${header(context)}<main><div class="ticket"><div class="top"><h2>${text(context, "sobre")}</h2><div class="num" data-fit="0.32">${text(context, "numero")}</div></div><div class="low"><b>${text(context, "detalle")}</b><span>${text(context, "condicion")}</span></div></div></main>${footer(context, text(context, "cuerpo"))}</div>`,
    };
  },
};
