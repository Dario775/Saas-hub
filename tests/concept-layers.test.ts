import assert from "node:assert/strict";
import test from "node:test";

import { cleanAlpha, isUsableCut, opaqueRatio } from "../src/components/composer/ai-background-removal";
import { contentBounds } from "../src/components/composer/trim-image";
import { createConceptLayers, fitHeadline, wrapText } from "../src/components/composer/concept-layers";

const FORMATS = [
  [1080, 1080],
  [1080, 1920],
  [1080, 1350],
  [1920, 1080],
] as const;

function layersFor(width: number, height: number, copy = {}) {
  return createConceptLayers({
    copy: { headline: "Automatizá tu negocio", subtitle: "Menos planillas y más ventas", cta: "Escribinos hoy", ...copy },
    width,
    height,
    accentColor: "#2ecc71",
    headingFont: "Montserrat",
    bodyFont: "Inter",
    logoId: "neurocortex",
    logoDataUrl: "data:image/svg+xml;base64,AA==",
    brandName: "Neurocortex",
    website: "https://www.neurocortex.com.ar/",
  });
}

test("todas las capas entran en el lienzo en cualquier formato", () => {
  for (const [width, height] of FORMATS)
    for (const layer of layersFor(width, height)) {
      assert.ok(layer.x >= 0 && layer.y >= 0, `${layer.id} en ${width}x${height}`);
      assert.ok(layer.x + layer.width <= width, `${layer.id} en ${width}x${height}`);
      assert.ok(layer.y + layer.height <= height, `${layer.id} en ${width}x${height}`);
    }
});

test("el texto es editable, conserva acentos y no se superpone", () => {
  for (const [width, height] of FORMATS) {
    const layers = layersFor(width, height);
    const title = layers.find((layer) => layer.id === "title-default")!;
    const subtitle = layers.find((layer) => layer.id === "subtitle-default")!;
    const cta = layers.find((layer) => layer.id === "cta-default")!;
    assert.equal(title.type, "text");
    assert.match((title as { text: string }).text.replace(/\n/g, " "), /Automatizá tu negocio/);
    assert.ok(title.y + title.height <= subtitle.y);
    assert.ok(subtitle.y + subtitle.height <= cta.y);
  }
});

test("usa el logo cargado por la marca", () => {
  const logo = layersFor(1080, 1080).find((layer) => layer.type === "brand-logo");
  assert.equal((logo as { customDataUrl?: string }).customDataUrl, "data:image/svg+xml;base64,AA==");
});

test("sin bajada ni botón no crea capas vacías", () => {
  const ids = layersFor(1080, 1080, { subtitle: "", cta: undefined }).map((layer) => layer.id);
  assert.ok(!ids.includes("subtitle-default"));
  assert.ok(!ids.includes("cta-default"));
});

test("un titular largo se achica en vez de cortarse", () => {
  const long = fitHeadline("Transformación digital internacionalización", 900, 108);
  assert.ok(long.fontSize < 108);
  assert.ok(long.lines.length <= 3);
  assert.deepEqual(wrapText("uno dos", 10, 1000), ["uno dos"]);
});

test("la limpieza del alfa quita el halo y cierra lo casi opaco", () => {
  assert.equal(cleanAlpha(5), 0);
  assert.equal(cleanAlpha(250), 255);
  assert.ok(cleanAlpha(128) > 100 && cleanAlpha(128) < 160);
});

test("descarta recortes vacíos o que no quitaron nada", () => {
  assert.equal(opaqueRatio([0, 0, 0, 255, 0, 0, 0, 0]), 0.5);
  assert.equal(opaqueRatio([]), 0);
  assert.equal(isUsableCut(0), false);
  assert.equal(isUsableCut(1), false);
  assert.equal(isUsableCut(0.25), true);
});

test("incluye nombre y web de la marca, sin protocolo", () => {
  const texts = layersFor(1080, 1350).flatMap((layer) => (layer.type === "text" ? [layer.text] : []));
  assert.ok(texts.includes("Neurocortex"));
  assert.ok(texts.includes("www.neurocortex.com.ar"));
});

test("el botón y la web no se superponen", () => {
  for (const [width, height] of FORMATS) {
    const layers = layersFor(width, height);
    const cta = layers.find((layer) => layer.id === "cta-default")!;
    const web = layers.find((layer) => layer.id === "brand-website")!;
    assert.ok(cta.x + cta.width < web.x, `${width}x${height}`);
  }
});

test("encuentra el contenido visible de un logo con margen", () => {
  const size = 10;
  const data = new Uint8ClampedArray(size * size * 4);
  for (const [x, y] of [[3, 4], [6, 7]]) data[(y * size + x) * 4 + 3] = 255;
  assert.deepEqual(contentBounds(data, size, size), { x: 3, y: 4, width: 4, height: 4 });
  assert.equal(contentBounds(new Uint8ClampedArray(size * size * 4), size, size), null);
});
