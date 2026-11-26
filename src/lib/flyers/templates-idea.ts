import { brandMark, escapeHtml, footer, header, list, table, text, type FlyerTemplate } from "./template";

const HEADLINE = { key: "titular", label: "Titular: la idea en una frase corta", kind: "text", max: 44 } as const;
const BODY = { key: "cuerpo", label: "Qué hace la marca, en una oración", kind: "text", max: 90 } as const;
const LABEL = { key: "etiqueta", label: "Etiqueta breve del tema", kind: "text", max: 28, optional: true } as const;

/** El flyer es la planilla caótica que el cliente ya tiene. */
export const planilla: FlyerTemplate = {
  id: "planilla",
  name: "Planilla",
  purpose:
    "Problema reconocible de gestión: todo el flyer es una planilla desordenada y la celda seleccionada dice la verdad incómoda. Con humor seco.",
  asset: null,
  tones: ["claro"],
  slots: [
    { key: "archivo", label: "Nombre de archivo ridículo pero real", kind: "text", max: 38 },
    { key: "formula", label: "Fórmula absurda que delata el problema", kind: "text", max: 62 },
    { key: "columnas", label: "Encabezados", kind: "list", max: 16, items: [5, 5] },
    { key: "filas", label: "Datos con errores, dudas y notas (usar #¡REF!, #N/D, revisar, ¿cuál va?)", kind: "table", max: 14, items: [3, 3], columns: 5 },
    { key: "total", label: "Fila de total, con error", kind: "list", max: 16, items: [5, 5] },
    { key: "hojas", label: "Nombres de pestañas (por ejemplo: Stock (copia), NO TOCAR)", kind: "list", max: 14, items: [4, 5] },
    { ...HEADLINE, max: 48 },
    { key: "cierre", label: "Cierre, primera línea", kind: "text", max: 46 },
    { key: "cierreAcento", label: "Cierre, segunda línea destacada", kind: "text", max: 36 },
  ],
  render(context) {
    const cell = (value: string) => {
      const kind = value.startsWith("#") || /no tocar/i.test(value) ? "err" : /\?|revisar|avisar/i.test(value) ? "warn" : "";
      return `<td class="${kind}">${value}</td>`;
    };
    const row = (number: number, cells: string[]) => `<tr><th class="n">${number}</th>${cells.map(cell).join("")}</tr>`;
    const rows = table(context, "filas");
    const tall = context.height > 1500;
    const blanks = Array.from({ length: tall ? 11 : context.height < 1200 ? 4 : 7 }, (_, index) => row(index + 5, ["", "", "", "", ""]));
    const end = blanks.length + 5;
    const heroHeight = blanks.length * 66;
    const extra = Array.from({ length: 6 }, (_, index) => row(end + 1 + index, ["", "", "", "", ""]));
    return {
      css: `
body{background:#fff;color:#1f2a33}
.sheet{position:absolute;inset:0;bottom:264px;overflow:hidden}
.bar{height:84px;background:#0f7b45;color:#fff;display:flex;align-items:center;padding:0 34px;font-size:27px;font-weight:500}
.fx{height:58px;background:#f4f5f4;border-bottom:2px solid #cfd5d1;display:flex;align-items:center;font-size:24px;color:#4a555c;white-space:nowrap;overflow:hidden}
.fx b{width:112px;flex:none;text-align:center;border-right:2px solid #cfd5d1;line-height:58px;font-weight:500}.fx i{padding:0 20px;color:#8b959b}
table{border-collapse:collapse;table-layout:fixed;width:1080px}
td,th{border:1.5px solid #d8dedb;height:66px;font-size:24px;padding:0 14px;white-space:nowrap;overflow:hidden;font-weight:400;text-align:left}
th{background:#f4f5f4;color:#69747a;text-align:center;height:44px;font-size:21px;font-weight:500}th.n{height:66px;padding:0}
.err{color:#c62828;background:#fdecea}.warn{background:#fff6cf}
.hero{position:absolute;left:72px;top:450px;width:1012px;height:${heroHeight}px;background:#fff;border:6px solid #0f7b45;padding:0 46px;display:flex;align-items:center;overflow:hidden}
.hero:after{content:"";position:absolute;right:2px;bottom:-11px;width:18px;height:18px;background:#0f7b45;border:4px solid #fff}
.hero h1{font-size:${context.height < 1200 ? 104 : 132}px;color:var(--ink);width:100%}
.tabs{position:absolute;left:0;right:0;bottom:264px;height:56px;background:#eceeec;border-top:2px solid #cfd5d1;display:flex;font-size:23px;color:#5b666c;overflow:hidden}
.tabs span{padding:0 26px;line-height:54px;border-right:2px solid #cfd5d1;white-space:nowrap}
.tabs .on{background:#fff;color:#0f7b45;font-weight:600;border-bottom:5px solid #0f7b45}
.foot{position:absolute;left:0;right:0;bottom:0;height:264px;background:var(--ink);color:#fff;padding:44px 56px 0}
.foot>p{font-size:43px;line-height:1.16;font-weight:500;letter-spacing:-.015em}.foot em{font-style:normal;color:${context.theme.accent}}
.foot footer{margin-top:32px;align-items:center}`,
      body: `<div class="sheet"><div class="bar" data-static>${text(context, "archivo")}</div><div class="fx" data-static><b>B7</b><i>fx</i>${text(context, "formula")}</div>
<table data-static><colgroup><col style="width:72px"><col style="width:250px"><col style="width:178px"><col style="width:200px"><col style="width:200px"><col style="width:180px"></colgroup>
<tr><th></th>${["A", "B", "C", "D", "E"].map((letter) => `<th>${letter}</th>`).join("")}</tr>
${row(1, list(context, "columnas"))}${rows.map((cells, index) => row(index + 2, cells)).join("")}${blanks.join("")}${row(end, list(context, "total"))}${extra.join("")}</table>
<div class="hero"><h1 data-fit="${((heroHeight - 40) / context.height).toFixed(3)}">${text(context, "titular")}</h1></div></div>
<div class="tabs" data-static>${list(context, "hojas").map((name, index) => `<span class="${index === 1 ? "on" : ""}">${name}</span>`).join("")}</div>
<div class="foot"><p>${text(context, "cierre")}<br><em>${text(context, "cierreAcento")}</em></p><footer>${brandMark(context, context.logoLightUrl)}${context.website ? `<b>${escapeHtml(context.website)}</b>` : ""}</footer></div>`,
    };
  },
};

/** Una conversación interna que muestra el problema. */
export const chat: FlyerTemplate = {
  id: "chat",
  name: "Conversación",
  purpose: "Problema de comunicación interna o atención: un chat breve, real y con remate, que el cliente reconoce porque lo vive.",
  asset: null,
  tones: ["claro", "oscuro", "acento"],
  slots: [
    LABEL,
    { key: "mensajes", label: "Mensajes en orden: [autor, texto, hora]. Autor 'yo' va a la derecha. El último es el remate", kind: "table", max: 70, items: [4, 5], columns: 3 },
    HEADLINE,
    BODY,
  ],
  render(context) {
    const bubbles = table(context, "mensajes")
      .map(([author, message, time]) => {
        const mine = author?.toLowerCase() === "yo";
        return `<div class="msg ${mine ? "mine" : ""}">${mine ? "" : `<small data-static>${author}</small>`}<p>${message}</p><time data-static>${time}</time></div>`;
      })
      .join("");
    return {
      css: `
.talk{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center}.talk>div{display:flex;flex-direction:column;gap:20px}
.msg{max-width:78%;align-self:flex-start;background:${context.theme.dark ? "#ffffff" : "#fff"};color:#14202b;border-radius:34px 34px 34px 10px;padding:22px 30px 18px;box-shadow:0 12px 34px rgba(0,0,0,.1)}
.msg.mine{align-self:flex-end;background:${context.theme.bg === context.theme.accent ? context.theme.ink : context.theme.accent};color:${context.theme.bg === context.theme.accent ? "#fff" : context.theme.onAccent};border-radius:34px 34px 10px 34px}
.msg small{font-size:22px;font-weight:700;color:var(--deep);display:block;margin-bottom:4px}
.msg p{font-size:${context.height < 1200 ? 31 : 37}px;line-height:1.22;font-weight:500}.msg time{font-size:20px;opacity:.6;display:block;text-align:right;margin-top:2px}
h1{font-size:${context.height < 1200 ? 88 : 112}px}`,
      body: `<div class="page">${header(context, text(context, "etiqueta"))}<main><div class="talk"><div data-shrink>${bubbles}</div></div></main><h1 data-fit="0.2">${text(context, "titular")}</h1>${footer(context, text(context, "cuerpo"))}</div>`,
    };
  },
};

/** Las áreas de la empresa convergen en un punto. */
export const red: FlyerTemplate = {
  id: "red",
  name: "Red",
  purpose: "Integración: varias áreas, sistemas o pasos dispersos que llegan a un solo lugar. Diagrama gráfico grande, sin fotos.",
  asset: null,
  tones: ["claro", "oscuro", "acento"],
  slots: [
    LABEL,
    { ...HEADLINE, max: 34 },
    { key: "nodos", label: "Elementos dispersos, una palabra cada uno", kind: "list", max: 10, items: [5, 5] },
    { key: "centro", label: "Palabra del centro (por ejemplo: Vos)", kind: "text", max: 8 },
    BODY,
  ],
  render(context) {
    const { theme } = context;
    const line = theme.fg;
    const onNode = theme.bg === theme.accent ? theme.paper : theme.bg;
    const hub = theme.bg === theme.accent ? theme.paper : theme.accent;
    const spots = [[112, 130], [112, 320], [112, 510], [370, 56], [370, 586]];
    const nodes = list(context, "nodos").slice(0, 5);
    return {
      css: `h1{font-size:150px;line-height:.92}svg{flex:1;min-height:0;width:100%}svg text{font-family:'Inter Tight';font-weight:600;letter-spacing:-.02em}`,
      body: `<div class="page">${header(context, text(context, "etiqueta"))}<h1 data-fit="0.24">${text(context, "titular")}</h1>
<main><svg viewBox="0 0 960 642" preserveAspectRatio="xMidYMid meet"><g stroke="${line}" stroke-width="13" stroke-linecap="round">${nodes.map((_, index) => `<path d="M${spots[index][0]} ${spots[index][1]} L682 321"/>`).join("")}</g>
<circle cx="682" cy="321" r="226" fill="${line}"/><circle cx="682" cy="321" r="104" fill="${hub}"/>
${nodes.map((name, index) => `<circle cx="${spots[index][0]}" cy="${spots[index][1]}" r="74" fill="${line}"/><text x="${spots[index][0]}" y="${spots[index][1] + 8}" font-size="${name.length > 8 ? 24 : 28}" text-anchor="middle" fill="${onNode}">${name}</text>`).join("")}
<text x="682" y="334" font-size="40" text-anchor="middle" fill="${theme.ink}" style="font-weight:700">${text(context, "centro")}</text></svg></main>${footer(context, text(context, "cuerpo"))}</div>`,
    };
  },
};

/** Maqueta de una página web dibujada, para vender sitios y landings. */
export const ventana: FlyerTemplate = {
  id: "ventana",
  name: "Ventana",
  purpose: "Productos digitales (sitios, landings, sistemas): una página de ejemplo dibujada en una ventana de navegador.",
  asset: null,
  tones: ["claro", "oscuro", "acento"],
  slots: [
    LABEL,
    HEADLINE,
    { key: "sitio", label: "Nombre del negocio ficticio del ejemplo", kind: "text", max: 22 },
    { key: "sitioTitular", label: "Titular de esa página", kind: "text", max: 40 },
    { key: "sitioBoton", label: "Botón de esa página", kind: "text", max: 18 },
    { key: "sitioItems", label: "Tres servicios de ese negocio", kind: "list", max: 18, items: [3, 3] },
    BODY,
  ],
  render(context) {
    const { theme } = context;
    return {
      css: `h1{font-size:126px}
.win{flex:1;min-height:0;margin:6px -150px 0 0;background:#fff;color:#15212c;border-radius:22px;box-shadow:0 18px 40px rgba(0,10,24,.2);overflow:hidden;display:flex;flex-direction:column}
.chrome{height:64px;flex:none;background:#eef0f2;display:flex;align-items:center;gap:13px;padding:0 26px}.chrome i{width:18px;height:18px;border-radius:50%;background:#c9cfd4}.chrome u{flex:1;height:36px;margin-left:20px;border-radius:18px;background:#fff;text-decoration:none;font-size:20px;color:#7d8890;line-height:36px;padding:0 22px}
.nav{display:flex;justify-content:space-between;padding:26px 44px;font-size:25px;font-weight:700}.nav span{display:flex;gap:30px;font-weight:500;color:#73808a}
.sec{flex:1;min-height:0;background:${theme.deep};color:#fff;margin:0 44px ${context.height < 1200 ? 34 : 0}px;border-radius:18px;padding:40px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:24px}
.sec h2{font-size:60px;line-height:1.02;letter-spacing:-.025em;font-weight:700;max-width:640px}.sec a{background:${theme.accent};color:${theme.onAccent};font-size:25px;font-weight:700;padding:15px 30px;border-radius:40px}
.cards{display:${context.height < 1200 ? "none" : "flex"};gap:20px;padding:26px 44px 40px;flex:none}.cards div{flex:1;border:2px solid #e4e8eb;border-radius:14px;padding:24px;font-size:24px;font-weight:600}.cards div:before{content:"";display:block;width:40px;height:40px;border-radius:10px;background:${theme.accent};margin-bottom:14px}`,
      body: `<div class="page">${header(context, text(context, "etiqueta"))}<h1 data-fit="0.24">${text(context, "titular")}</h1>
<main><div class="win" data-static><div class="chrome"><i></i><i></i><i></i><u>https://</u></div><div class="nav">${text(context, "sitio")}<span><em>Inicio</em><em>Servicios</em><em>Contacto</em></span></div>
<div class="sec"><h2>${text(context, "sitioTitular")}</h2><a>${text(context, "sitioBoton")}</a></div><div class="cards">${list(context, "sitioItems").map((item) => `<div>${item}</div>`).join("")}</div></div></main>${footer(context, text(context, "cuerpo"))}</div>`,
    };
  },
};
