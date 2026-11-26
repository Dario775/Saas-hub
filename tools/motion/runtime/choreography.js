/*
 * Coreografía de los flyers animados. Corre dentro del video, después de GSAP.
 *
 * Lee window.__MOTION = { id, template, duration, bpm, accent, hook, outro } y
 * registra una sola línea de tiempo pausada en window.__timelines[id], como
 * pide HyperFrames. Se completa cuando cargan las fuentes: la transición mide
 * dónde quedó cada palabra del titular después de que el flyer ajustó tamaños.
 *
 * Tres tiempos, sin cortes ni fundidos de escena:
 *   1. Gancho: el titular en grande, palabra por palabra.
 *   2. Las palabras viajan a su lugar en el flyer y el diseño se arma alrededor.
 *   3. Un círculo de color crece desde el elemento clave y se vuelve la placa final.
 * Todo es determinista: sin relojes, sin azar y sin repeticiones infinitas.
 *
 * Cada entrada arranca sobre la grilla del tempo (corcheas), la misma que usa
 * el sonido. Curvas exponenciales y sin rebotes: movimientos rápidos que se
 * asientan, que es donde el desenfoque de movimiento luce.
 */
(function () {
  var config = window.__MOTION;
  /*
   * Todo se coreografía sobre una grilla de referencia a 120 BPM (tiempo de
   * 0,5 s). La línea interna se acelera o se frena con el tempo del estilo:
   * a 84 BPM todo va más calmo y a 124 más rápido, siempre sobre el golpe.
   */
  var SPEED = (config.bpm || 120) / 120;
  var BEAT = 0.5;
  var STEP = BEAT / 2;
  /** Segundos reales del video → segundos de la grilla de referencia. */
  function ref(seconds) {
    return seconds * SPEED;
  }
  var OUTRO = ref(config.outro.start);
  var outer = gsap.timeline({ paused: true });
  var master = gsap.timeline();
  master.timeScale(SPEED);
  outer.add(master, 0);
  /** Línea en la que escriben los ayudantes: la de la escena o la principal. */
  var tl = master;

  /** Lleva un instante a la corchea más cercana. */
  function snap(time) {
    return Math.max(0, Math.round(time / STEP) * STEP);
  }

  function all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }
  function one(selector, root) {
    return (root || document).querySelector(selector);
  }

  /** Envuelve cada palabra para que entre por separado. Respeta los estilos internos. */
  function splitWords(element) {
    if (!element) return [];
    if (element.__words) return element.__words;
    var parts = [];
    var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var pieces = node.textContent.split(/(\s+)/);
      if (pieces.length < 2 && !pieces[0].trim()) return;
      var fragment = document.createDocumentFragment();
      pieces.forEach(function (piece) {
        if (!piece) return;
        if (/^\s+$/.test(piece)) {
          fragment.appendChild(document.createTextNode(piece));
          return;
        }
        var word = document.createElement("span");
        word.className = "mw";
        word.textContent = piece;
        fragment.appendChild(word);
        parts.push(word);
      });
      node.parentNode.replaceChild(fragment, node);
    });
    element.__words = parts;
    return parts;
  }

  /** Entrada de un titular: palabra por palabra. */
  function headline(element, at, stagger) {
    at = snap(at);
    // El titular del gancho llega viajando: no tiene entrada propia.
    if (hooked && element === hookTarget) return at;
    var words = splitWords(element);
    if (!words.length) return at;
    tl.from(words, { yPercent: 110, opacity: 0, duration: 0.75, stagger: stagger || 0.07 }, at);
    return at + 0.75 + (words.length - 1) * (stagger || 0.07);
  }

  function rise(targets, at, options) {
    var list = Array.isArray(targets) ? targets.filter(Boolean) : targets ? [targets] : [];
    at = snap(at);
    if (!list.length) return at;
    var settings = Object.assign({ y: 70, opacity: 0, duration: 0.6, stagger: 0.12 }, options || {});
    tl.from(list, settings, at);
    return at + settings.duration + (list.length - 1) * settings.stagger;
  }

  /** Cuenta hasta el número del titular (10%, $4.500, 3x). */
  function countUp(element, at) {
    at = snap(at);
    if (!element || (hooked && element === hookTarget)) return at;
    var match = /^(\D*)(\d[\d.,]*)(\D*)$/.exec(element.textContent.trim());
    if (!match) return rise(element, at, { scale: 0.8, y: 0 });
    var digits = match[2];
    var separator = /\d[.,]\d{3}\b/.test(digits) ? digits.replace(/\d/g, "")[0] : "";
    var target = Number(digits.replace(/[.,]/g, ""));
    var counter = { value: 0 };
    var format = function (value) {
      var text = String(Math.round(value));
      return separator ? text.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : text;
    };
    element.textContent = match[1] + format(0) + match[3];
    tl.from(element, { scale: 0.86, opacity: 0, duration: 0.5 }, at);
    tl.to(
      counter,
      {
        value: target,
        duration: 1.1,
        ease: "power2.out",
        onUpdate: function () {
          element.textContent = match[1] + format(counter.value) + match[3];
        },
      },
      at,
    );
    return at + 1.1;
  }

  /** Dibuja las líneas de un SVG de a una. */
  function drawPaths(paths, at) {
    at = snap(at);
    paths.forEach(function (path, index) {
      var length = path.getTotalLength ? path.getTotalLength() : 0;
      if (!length) return;
      path.setAttribute("stroke-dasharray", String(length));
      tl.fromTo(
        path,
        { attr: { "stroke-dashoffset": length } },
        { attr: { "stroke-dashoffset": 0 }, duration: 0.6, ease: "power2.inOut" },
        at + index * 0.12,
      );
    });
    return at + 0.6 + Math.max(0, paths.length - 1) * 0.12;
  }

  /** Qué viaja desde el gancho y desde dónde crece la placa final, por diseño. */
  var HOOK_SELECTORS = { planilla: ".hero h1", objeto: ".words", oferta: ".num" };
  var KEY_SELECTORS = {
    planilla: ".foot",
    chat: ".msg:last-child",
    red: "main svg",
    ventana: ".sec a",
    afirmacion: "h1 em",
    comparativa: ".side:last-of-type",
    pasos: "ol li:last-child b",
    oferta: ".ticket",
    foto: "h1",
    objeto: ".obj",
  };
  var hookTarget = one(HOOK_SELECTORS[config.template] || "h1");
  var hooked = false;

  var page = one(".page");
  var header = one("header");
  var footer = one(".page > footer") || one(".foot");
  var at = 0;

  // Cada diseño tiene su propia entrada; el resto lo resuelve la genérica.
  var scenes = {
    planilla: function () {
      var t = rise(one(".bar"), 0.1, { y: -30 });
      rise(one(".fx"), 0.25, { y: -20 });
      t = rise(all("table tr"), 0.4, { y: 18, duration: 0.35, stagger: 0.05 });
      rise(one(".tabs"), t - 0.2, { y: 30 });
      t = headline(one(".hero h1"), t + 0.1, 0.08);
      return rise(one(".foot"), t, { y: 0, yPercent: 100, opacity: 1, duration: 0.8, ease: "power4.out" });
    },
    chat: function () {
      var t = rise(header, at, { y: -24 });
      all(".msg").forEach(function (bubble, index) {
        var mine = bubble.classList.contains("mine");
        tl.from(
          bubble,
          { y: 50, scale: 0.85, opacity: 0, duration: 0.5, transformOrigin: mine ? "100% 100%" : "0% 100%" },
          t + index * BEAT * 1.5,
        );
      });
      t = t + all(".msg").length * BEAT * 1.5;
      return headline(one("h1"), t, 0.07);
    },
    red: function () {
      var t = rise(header, at, { y: -24 });
      t = headline(one("h1"), t - 0.3);
      var svg = one("main svg");
      var circles = all("circle", svg);
      var hubs = circles.filter(function (circle) {
        return circle.getAttribute("cx") === "682";
      });
      t = snap(t);
      tl.from(hubs, { scale: 0, svgOrigin: "682 321", duration: 0.7, stagger: STEP / 2 }, t);
      t = drawPaths(all("path", svg), t + 0.3);
      var nodes = circles.filter(function (circle) {
        return hubs.indexOf(circle) < 0;
      });
      nodes.forEach(function (circle, index) {
        tl.from(circle, { scale: 0, transformOrigin: "50% 50%", duration: 0.45 }, snap(t - 0.5) + index * 0.1);
      });
      rise(all("text", svg), t - 0.2, { y: 0, duration: 0.4, stagger: 0.06 });
      return t + 0.4;
    },
    ventana: function () {
      var t = rise(header, at, { y: -24 });
      t = headline(one("h1"), t - 0.3);
      t = rise(one(".win"), t - 0.2, { y: 140, duration: 0.9, ease: "power4.out" });
      t = rise([one(".nav"), one(".sec h2"), one(".sec a")], t - 0.4, { y: 24, stagger: 0.15 });
      var button = one(".sec a");
      if (button) tl.to(button, { scale: 1.08, duration: STEP, yoyo: true, repeat: 1, ease: "power2.inOut" }, snap(t + 0.2));
      return rise(all(".cards > div"), t - 0.1, { y: 30, stagger: 0.1 });
    },
    afirmacion: function () {
      var t = rise(header, at, { y: -24 });
      var h1 = one("h1");
      var mark = one("h1 em");
      if (mark) tl.from(mark, { scaleX: 0, transformOrigin: "0% 50%", duration: 0.6 }, snap(t + 0.6));
      return headline(h1, t - 0.2, 0.09);
    },
    comparativa: function () {
      var t = rise(header, at, { y: -24 });
      t = headline(one("h1"), t - 0.3);
      var sides = all(".side");
      t = rise(sides[0], t - 0.2, { x: -60, y: 0 });
      t = rise(all("li", sides[0]), t - 0.3, { y: 16, stagger: 0.1 });
      t = rise(sides[1], t, { xPercent: 100, y: 0, opacity: 1, duration: 0.7, ease: "power4.out" });
      return rise(all("li", sides[1]), t - 0.3, { x: 30, y: 0, stagger: 0.12 });
    },
    pasos: function () {
      var t = rise(header, at, { y: -24 });
      t = headline(one("h1"), t - 0.3);
      t = snap(t);
      all("ol li").forEach(function (item, index) {
        var start = t + index * BEAT;
        tl.from(one("b", item), { scale: 0, transformOrigin: "30% 70%", duration: 0.5 }, start);
        tl.from(one("span", item), { x: 60, opacity: 0, duration: 0.55 }, start + 0.08);
      });
      return t + all("ol li").length * BEAT + 0.4;
    },
    oferta: function () {
      var t = rise(header, at, { y: -24 });
      if (!hooked) t = rise(one(".ticket"), t - 0.2, { y: 90, scale: 0.9, rotation: -3, duration: 0.8 });
      rise(one(".top h2"), t - 0.4, { y: 20 });
      t = countUp(one(".num"), t - 0.2);
      return rise(all(".low > *"), t - 0.3, { y: 20, stagger: 0.15 });
    },
    foto: function () {
      var photo = one(".photo");
      if (photo) tl.fromTo(photo, { scale: 1.14 }, { scale: 1, duration: ref(config.duration), ease: "none" }, 0);
      rise(one(".shade"), 0, { y: 0, duration: 1.2, ease: "none" });
      var t = rise(header, 0.4, { y: -24 });
      return headline(one("h1"), t, 0.08);
    },
    objeto: function () {
      var t = rise(header, at, { y: -24 });
      var words = one(".words");
      t = headline(words, t - 0.2, 0.12);
      var object = one(".obj");
      if (object) {
        tl.from(object, { y: 120, scale: 0.86, opacity: 0, duration: 0.9 }, snap(t - 0.5));
        tl.to(object, { y: -14, duration: BEAT * 4, ease: "sine.inOut", yoyo: true, repeat: 3 }, snap(t + 0.4));
      }
      return t + 0.4;
    },
  };

  // ---- Medidas (antes de cualquier tween: sin transformaciones aplicadas) ----

  function frameRect(element) {
    var frame = one("#scene").getBoundingClientRect();
    var rect = element.getBoundingClientRect();
    return { left: rect.left - frame.left, top: rect.top - frame.top, width: rect.width, height: rect.height };
  }

  function readType(word) {
    var style = getComputedStyle(word);
    var size = parseFloat(style.fontSize);
    var line = parseFloat(style.lineHeight);
    return {
      text: word.textContent,
      rect: frameRect(word),
      size: size,
      line: isNaN(line) ? size * 1.15 : line,
      spacing: parseFloat(style.letterSpacing) || 0,
      family: style.fontFamily,
      weight: style.fontWeight,
      italic: style.fontStyle,
      transform: style.textTransform,
      color: style.color,
    };
  }

  /** Aplica la tipografía de la palabra, escalada por k. */
  function typeset(element, type, k) {
    var css = element.style;
    css.fontFamily = type.family;
    css.fontWeight = type.weight;
    css.fontStyle = type.italic;
    css.textTransform = type.transform;
    css.color = type.color;
    css.fontSize = type.size * k + "px";
    css.lineHeight = type.line * k + "px";
    css.letterSpacing = type.spacing * k + "px";
    css.whiteSpace = "nowrap";
  }

  /** Dónde queda cada palabra si el titular se arma en grande y centrado. */
  function bigLayout(types, k, layer) {
    var box = document.createElement("div");
    box.className = "hook-measure";
    box.style.columnGap = types[0].size * k * 0.28 + "px";
    types.forEach(function (type) {
      var word = document.createElement("span");
      typeset(word, type, k);
      word.textContent = type.text;
      box.appendChild(word);
    });
    layer.appendChild(box);
    var rects = Array.prototype.map.call(box.children, frameRect);
    box.remove();
    return rects;
  }

  function blockHeight(rects) {
    var top = Math.min.apply(null, rects.map(function (rect) { return rect.top; }));
    var bottom = Math.max.apply(null, rects.map(function (rect) { return rect.top + rect.height; }));
    return bottom - top;
  }

  function luminance(color) {
    var rgb = (color.match(/[\d.]+/g) || ["0", "0", "0"]).slice(0, 3).map(function (value) {
      var channel = Number(value) / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  function opaque(color) {
    var parts = color.match(/[\d.]+/g) || [];
    return parts.length >= 3 && (parts.length < 4 || Number(parts[3]) > 0.5);
  }

  /** Color que la palabra tiene detrás: el primer contenedor con fondo, o el del flyer. */
  function backgroundBehind(element) {
    var scene = one("#scene");
    for (var node = element.parentElement; node && node !== scene; node = node.parentElement) {
      var color = getComputedStyle(node).backgroundColor;
      if (opaque(color)) return color;
    }
    var backdrop = one(".backdrop");
    return backdrop ? getComputedStyle(backdrop).backgroundColor : "rgb(255,255,255)";
  }

  /** Fondo del gancho: el que el titular tiene detrás, salvo que no se lea sobre él. */
  function hookBackground(textColor) {
    var color = backgroundBehind(hookTarget);
    var a = luminance(color);
    var b = luminance(textColor);
    var contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (contrast >= 3) return color;
    return b > 0.4 ? "#0b0b0d" : "#ffffff";
  }

  /** Prepara el gancho: copias de las palabras del titular, en su lugar final. */
  function measureHook() {
    if (!hookTarget) return null;
    var words = splitWords(hookTarget);
    if (!words.length) return null;
    var types = words.map(readType);
    var scene = one("#scene");
    var layer = document.createElement("div");
    layer.className = "hook";
    scene.appendChild(layer);
    var frame = scene.getBoundingClientRect();
    var widest = Math.max.apply(null, types.map(function (type) { return type.rect.width; }));
    var k = Math.min(3.2, (frame.width * 0.84) / widest);
    var big = bigLayout(types, k, layer);
    while (k > 1.25 && blockHeight(big) > frame.height * 0.62) {
      k = k * 0.9;
      big = bigLayout(types, k, layer);
    }
    // Si el titular ya es enorme, no hay viaje que mostrar: entrada normal.
    if (k < 1.25) {
      layer.remove();
      return null;
    }
    var background = document.createElement("div");
    background.className = "hook-bg";
    background.style.background = hookBackground(types[0].color);
    layer.appendChild(background);
    var copies = types.map(function (type, index) {
      var outer = document.createElement("span");
      var inner = document.createElement("span");
      outer.className = "hw";
      outer.style.left = type.rect.left + "px";
      outer.style.top = type.rect.top + "px";
      typeset(outer, type, 1);
      inner.textContent = type.text;
      outer.appendChild(inner);
      layer.appendChild(outer);
      return { outer: outer, inner: inner, from: { x: big[index].left - type.rect.left, y: big[index].top - type.rect.top, scale: k } };
    });
    return { words: words, layer: layer, background: background, copies: copies };
  }

  function measureKey() {
    var key = one(KEY_SELECTORS[config.template] || "h1") || hookTarget;
    var rect = key ? frameRect(key) : null;
    if (rect && rect.width * rect.height > 400) return rect;
    var frame = one("#scene").getBoundingClientRect();
    return { left: frame.width / 2, top: frame.height / 2, width: 0, height: 0 };
  }

  // ---- Armado ----

  function buildHook(hook) {
    var land = ref(config.hook.land);
    var travel = ref(config.hook.scene) - BEAT;
    var count = hook.copies.length;
    var inners = hook.copies.map(function (copy) { return copy.inner; });
    hook.copies.forEach(function (copy) {
      master.set(copy.outer, copy.from, 0);
    });
    master.set(hook.words, { opacity: 0 }, 0);
    if (config.template === "oferta" && count === 1) {
      tl = master;
      countUp(inners[0], STEP);
    } else {
      master.from(inners, { yPercent: 110, opacity: 0, duration: 0.7, stagger: Math.min(STEP, 1 / count), ease: "expo.out" }, 0);
    }
    var outers = hook.copies.map(function (copy) { return copy.outer; });
    master.to(outers, { x: 0, y: 0, scale: 1, duration: land - travel, ease: "expo.inOut" }, travel);
    master.to(hook.background, { opacity: 0, duration: land - travel, ease: "power2.inOut" }, travel);
    // Al llegar, las copias le dejan el lugar a las palabras reales.
    master.set(hook.words, { opacity: 1 }, land);
    master.set(hook.layer, { opacity: 0 }, land);
  }

  /** Círculo de acento que crece desde el elemento clave y se vuelve la placa final. */
  function buildIris(rect) {
    var frame = one("#scene").getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var radius =
      Math.max(
        Math.hypot(x, y),
        Math.hypot(frame.width - x, y),
        Math.hypot(x, frame.height - y),
        Math.hypot(frame.width - x, frame.height - y),
      ) + 8;
    var iris = document.createElement("div");
    iris.className = "iris";
    iris.style.left = x - radius + "px";
    iris.style.top = y - radius + "px";
    iris.style.width = iris.style.height = radius * 2 + "px";
    iris.style.background = config.accent;
    one("#scene").appendChild(iris);
    master.fromTo(iris, { scale: 0 }, { scale: 1, duration: BEAT, ease: "power4.in" }, OUTRO - BEAT);
    // Al entrar la placa, el círculo ya no hace falta.
    master.set(iris, { opacity: 0 }, OUTRO + STEP);
  }

  /** Placa final: el logo entra girando con un anillo que se expande, después el nombre y la web. */
  function buildOutro() {
    var outro = one(".outro");
    if (!outro) return;
    var start = OUTRO;
    var logo = one(".out-mark img");
    var ring = one(".out-ring");
    var name = one(".out-name");
    if (logo) {
      master.fromTo(logo, { scale: 0.35, rotation: -12, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.9, ease: "expo.out" }, start + STEP);
      master.to(logo, { scale: 1.06, duration: STEP, yoyo: true, repeat: 1, ease: "power2.inOut" }, start + BEAT * 3);
    }
    if (ring) master.fromTo(ring, { scale: 0.45, opacity: 0.8 }, { scale: 2.3, opacity: 0, duration: 1.3, ease: "expo.out" }, start + STEP);
    var after = logo ? start + BEAT : start + STEP;
    if (name) {
      var letters = splitWords(name);
      master.from(letters, { yPercent: 110, opacity: 0, duration: 0.7, stagger: 0.06, ease: "expo.out" }, after);
    }
    var rule = one(".out-rule");
    if (rule) master.from(rule, { scaleX: 0, duration: 0.6, ease: "expo.out" }, after + STEP);
    rise(all(".outro .out-cta, .outro .out-site"), after + BEAT, { y: 40, stagger: 0.12 });
  }

  function build() {
    var hook = measureHook();
    var keyRect = measureKey();
    hooked = Boolean(hook);
    var sceneStart = hook ? ref(config.hook.scene) : 0;
    tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    var scene = scenes[config.template];
    var end = scene ? scene() : headline(one("h1"), rise(header, at, { y: -24 }) - 0.3);
    if (footer && config.template !== "planilla") rise(footer, end - 0.2, { y: 30 });
    master.add(tl, sceneStart);
    tl = master;
    // Un empuje leve mantiene viva la imagen mientras se lee.
    if (page && config.template !== "foto")
      master.fromTo(page, { scale: 1 }, { scale: 1.025, duration: OUTRO - sceneStart, ease: "none" }, sceneStart);
    if (hook) buildHook(hook);
    buildIris(keyRect);
    buildOutro();
  }

  window.__timelines = window.__timelines || {};
  window.__timelines[config.id] = outer;
  // El flyer ajusta tamaños cuando cargan las fuentes; recién ahí se mide.
  document.fonts.ready.then(build);
})();
