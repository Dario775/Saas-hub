"use client";
import { LayerComposer } from "@/components/composer/LayerComposer";
import { useEffect,useState } from "react";
import { BRAND_LOGOS } from "../config";
import type { WorkspaceController } from "../hooks/use-workspace";
export default function ComposerView({
  controller,
}: {
  controller: WorkspaceController;
}) {
  // Se conservan mientras dure la vista: al limpiarlos, el editor cargaba el
  // borrador guardado encima de la imagen recién enviada.
  const [initialImage] = useState(controller.composerInitialImage);
  const [initialCopy] = useState(controller.composerInitialCopy);
  const [initialDesign] = useState(controller.composerInitialDesign);
  useEffect(() => {
    controller.setComposerInitialImage(null);
    controller.setComposerInitialCopy(null);
    controller.setComposerInitialDesign(null);
  }, []);
  const {
    tab,
    generatedImage,
    draftBrand,
    currentBrand,
    brands,
    setGeneratedImage,
    setMessage,
    message,
    setTab,
  } = controller;
  return (
    <>
      {" "}
      {tab === "composer" && (
        <div className="animate-fadeIn">
          <LayerComposer
            key={currentBrand.id}
            initialImage={initialDesign ? null : initialImage || generatedImage}
            initialCopy={initialCopy}
            initialDesign={initialDesign}
            brandContext={draftBrand || currentBrand}
            brandLogosMap={BRAND_LOGOS}
            availableBrands={brands.map((b) => ({ id: b.id, name: b.name }))}
            onExportToPublish={(base64) => {
              setGeneratedImage(base64);
              setMessage(message || "Flyer diseñado en Compositor de Capas");
              setTab("publish");
            }}
          />
        </div>
      )}{" "}
    </>
  );
}
