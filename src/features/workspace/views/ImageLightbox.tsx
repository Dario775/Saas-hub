"use client";
import { X } from "lucide-react";
import { ModalFrame } from "../ModalFrame";
import type { WorkspaceController } from "../hooks/use-workspace";
export default function ImageLightbox({
  controller,
}: {
  controller: WorkspaceController;
}) {
  return (
    <ModalFrame
      title="Vista previa de imagen"
      onClose={() => controller.setShowImageLightbox(false)}
    >
      <div className="relative">
        <img
          src={controller.generatedImage || ""}
          alt="Vista previa del diseño"
          className="max-h-[80dvh] w-auto rounded-xl"
        />
        <button
          aria-label="Cerrar vista previa"
          className="absolute right-3 top-3 rounded-lg bg-slate-950/90 p-2 text-white"
          onClick={() => controller.setShowImageLightbox(false)}
        >
          <X size={20} />
        </button>
      </div>
    </ModalFrame>
  );
}
