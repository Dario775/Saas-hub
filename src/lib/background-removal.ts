const MIN_RESOLUTION = 512;
const MAX_RESOLUTION = 1536;
const STEP = 32;
const REMOVAL_STEPS = 25;

/** Presupuesto de píxeles para el recorte: múltiplo de 32, dentro de lo que admite el modelo. */
export function removalResolution(width: unknown, height: unknown): number {
  const area = Number(width) * Number(height);
  const side = Number.isFinite(area) && area > 0 ? Math.sqrt(area) : 1024;
  return Math.max(MIN_RESOLUTION, Math.min(MAX_RESOLUTION, Math.round(side / STEP) * STEP));
}

/** Flujo oficial de Qwen Image 2.1 para quitar el fondo de una imagen ya subida a ComfyUI. */
export function buildBackgroundRemovalWorkflow(imageName: string, resolution: number) {
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: "qwen_image_2.1_int8_convrot.safetensors", weight_dtype: "default" } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: "qwen3vl_8b_int8_convrot.safetensors", type: "qwen_image", device: "default" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: "qwen_image_2.1_vae_bf16.safetensors" } },
    "20": { class_type: "LoadImage", inputs: { image: imageName } },
    "4": {
      class_type: "TextEncodeQwenImage21",
      inputs: {
        prompt: "Remove the background, and output a PNG image",
        negative_prompt: "",
        resolution,
        clip: ["2", 0],
        vae: ["3", 0],
        "images.image_1": ["20", 0],
      },
    },
    "6": {
      class_type: "KSampler",
      inputs: {
        seed: Math.floor(Math.random() * 2 ** 32),
        steps: REMOVAL_STEPS,
        cfg: 1,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1,
        model: ["1", 0],
        positive: ["4", 0],
        negative: ["4", 1],
        latent_image: ["4", 2],
      },
    },
    "8": { class_type: "VAEDecode", inputs: { samples: ["6", 0], vae: ["3", 0] } },
    "9": { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: "saas_hub_recorte" } },
  };
}
