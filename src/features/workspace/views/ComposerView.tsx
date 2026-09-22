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
  const [initialImage] = useState(controller.composerInitialImage);
  useEffect(() => {
    controller.setComposerInitialImage(null);
  }, []);
  const {
    tab,
    composerInitialImage,
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
            initialImage={composerInitialImage || generatedImage}
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
