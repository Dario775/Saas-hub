import assert from "node:assert/strict";
import test from "node:test";

import { designFromFlyer, textLayerFrom } from "../src/components/composer/flyer-design";
import { BACKGROUND_CSS, BACKGROUND_SCRIPT, LAYERS_SCRIPT } from "../src/lib/flyers/export-script";
import { parseMeasurements, type FlyerExport, type MeasuredText } from "../src/lib/flyers/flyer-layers";
import { buildFlyerHtml, findTemplate, FLYER_TEMPLATES } from "../src/lib/flyers/templates";
import { buildTheme } from "../src/lib/flyers/theme";
import { FLYER_SIZES } from "../src/lib/flyers/types";
import { FLYER_SAMPLES } from "./flyer-samples";

const TEXT: MeasuredText = {
  text: "Tu sistema\nhace casi todo.",
  left: 60,
  right: 840,
  center: 500,
  lineHeight: 140,
  fontSize: 152.4,
  fontFamily: "Inter Tight",
  fontWeight: 700,
  fontStyle: "normal",
  color: "rgb(255, 255, 255)",
  letterSpacing: -5.33,
  align: "left",
  opacity: 0.62,
};

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

test("un texto medido se vuelve una capa editable en el mismo lugar", () => {
  const layer = textLayerFrom(TEXT, 3);
  assert.equal(layer.type, "text");
  assert.equal(layer.text, TEXT.text);
  assert.equal(layer.x, 60);
  assert.equal(layer.width, 780);
  // Dos líneas de 140 px, centradas en 500.
  assert.equal(layer.height, 280);
  assert.equal(layer.y, 360);
  assert.equal(layer.lineHeight, Math.round((140 / 152.4) * 1000) / 1000);
  assert.equal(layer.opacity, 0.62);
  assert.equal(layer.locked, false);
});

test("el diseño lleva el fondo bloqueado abajo, luego el logo y los textos", () => {
  const exported: FlyerExport = {
    format: "4:5",
    ...FLYER_SIZES["4:5"],
    background: "data:image/jpeg;base64,AA==",
    logos: [{ src: "data:image/png;base64,AA==", left: 60, top: 58, width: 40, height: 44 }],
    texts: [TEXT, { ...TEXT, text: "Escribinos" }],
  };
  const design = designFromFlyer(exported);
  assert.equal(design.aspectRatio, "4:5");
  assert.deepEqual(design.layers.map((layer) => layer.type), ["background", "brand-logo", "text", "text"]);
  assert.equal(design.layers[0].locked, true);
  assert.equal(design.layers[0].width, 1080);
  assert.equal(new Set(design.layers.map((layer) => layer.id)).size, 4);
});

test("lo medido se valida: descarta textos vacíos y logos que no son imágenes", () => {
  const parsed = parseMeasurements(
    encode({
      texts: [TEXT, { ...TEXT, text: "  " }, { ...TEXT, fontSize: "x" }, { ...TEXT, align: "raro", opacity: 9 }],
      logos: [{ src: "javascript:alert(1)", left: 0, top: 0, width: 10, height: 10 }, { src: "data:image/png;base64,AA==", left: 1, top: 2, width: 3, height: 4 }],
    }),
  );
  assert.equal(parsed.texts.length, 2);
  assert.equal(parsed.texts[1].align, "left");
  assert.equal(parsed.texts[1].opacity, 1);
  assert.equal(parsed.logos.length, 1);
  assert.throws(() => parseMeasurements("no es base64 válido"));
});

test("cada sistema de diseño se puede exportar a capas", () => {
  for (const concept of FLYER_SAMPLES) {
    const template = findTemplate(concept.template)!;
    const context = {
      slots: concept.slots,
      theme: buildTheme({ primary: "#3498db", accent: "#2ecc71" }, concept.tone),
      ...FLYER_SIZES["4:5"],
      brandName: "Marca",
      website: "marca.com.ar",
      logoUrl: null,
      logoLightUrl: null,
      logoDarkUrl: null,
      assetUrl: null,
    };
    const layers = buildFlyerHtml(template, context, "Inter Tight", "layers");
    const background = buildFlyerHtml(template, context, "Inter Tight", "background");
    assert.ok(layers.includes("data-layers"), concept.template);
    assert.ok(background.includes("hub-hide"), concept.template);
    assert.ok(!buildFlyerHtml(template, context, "Inter Tight").includes("hub-hide"), concept.template);
  }
  assert.equal(FLYER_SAMPLES.length, FLYER_TEMPLATES.length);
});

test("el fondo oculta solo los textos editables, no lo que queda fijo", () => {
  assert.match(BACKGROUND_SCRIPT, /\[data-static\]/);
  assert.match(LAYERS_SCRIPT, /\[data-static\]/);
  // Ocultar contenedores haría desaparecer, por herencia, los textos fijos.
  assert.doesNotMatch(BACKGROUND_CSS, /body \*/);
});
