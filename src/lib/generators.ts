// Configuración de generadores de imagen disponibles en ComfyUI

export type ImageGenerator = "flux-dev" | "flux-schnell" | "ideogram-4" | "flux-2-klein" | "realvis-xl" | "z-image-turbo" | "gemini-3.1-flash-lite-image" | "gemini-3.1-flash-image" | "gemini-3-pro-image" | "gemini-2.5-flash-image" | "dall-e-3" | "dall-e-2";

export interface GeneratorParam {
  id: string;
  label: string;
  type: "number" | "select";
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

export interface GeneratorConfig {
  id: ImageGenerator;
  name: string;
  description: string;
  emoji: string;
  defaultParams: Record<string, number | string>;
  params: GeneratorParam[];
  buildWorkflow: (prompt: string, params: Record<string, number | string>, negative?: string) => Record<string, any>;
}

function seed() {
  return Math.floor(Math.random() * 2 ** 32);
}

// Alinear resolución a múltiplo de 16px (requerido por ComfyUI)
function alignRes(v: number): number {
  return Math.max(Math.round(v / 16) * 16, 256);
}

// Calcula MCD para aspect ratio
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export const IDEOGRAM_4_WORKFLOW: Record<string, any> = {
  "37": {
    "inputs": {
      "aspect_ratio": "9:16 (Portrait Widescreen)",
      "megapixels": 1,
      "multiple": 8
    },
    "class_type": "ResolutionSelector",
    "_meta": {
      "title": "Resolution Selector"
    }
  },
  "111": {
    "inputs": {
      "source": [
        "134:170",
        0
      ]
    },
    "class_type": "PreviewAny",
    "_meta": {
      "title": "Preview as Text"
    }
  },
  "158": {
    "inputs": {
      "filename_prefix": "Ideogram_4.0",
      "images": [
        "98:13",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "Save Image"
    }
  },
  "98:9": {
    "inputs": {
      "vae_name": "flux2-vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  },
  "98:10": {
    "inputs": {
      "conditioning": [
        "98:24",
        0
      ]
    },
    "class_type": "ConditioningZeroOut",
    "_meta": {
      "title": "ConditioningZeroOut"
    }
  },
  "98:11": {
    "inputs": {
      "width": [
        "98:31",
        1
      ],
      "height": [
        "98:32",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyFlux2LatentImage",
    "_meta": {
      "title": "Empty Flux 2 Latent"
    }
  },
  "98:12": {
    "inputs": {
      "noise": [
        "98:18",
        0
      ],
      "guider": [
        "98:155",
        0
      ],
      "sampler": [
        "98:16",
        0
      ],
      "sigmas": [
        "98:17",
        0
      ],
      "latent_image": [
        "98:11",
        0
      ]
    },
    "class_type": "SamplerCustomAdvanced",
    "_meta": {
      "title": "SamplerCustomAdvanced"
    }
  },
  "98:13": {
    "inputs": {
      "samples": [
        "98:12",
        0
      ],
      "vae": [
        "98:9",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "98:16": {
    "inputs": {
      "sampler_name": "euler"
    },
    "class_type": "KSamplerSelect",
    "_meta": {
      "title": "KSamplerSelect"
    }
  },
  "98:17": {
    "inputs": {
      "steps": [
        "98:151",
        1
      ],
      "width": [
        "98:31",
        1
      ],
      "height": [
        "98:32",
        1
      ],
      "mu": [
        "98:144",
        0
      ],
      "std": [
        "98:146",
        0
      ]
    },
    "class_type": "Ideogram4Scheduler",
    "_meta": {
      "title": "Ideogram 4 Scheduler"
    }
  },
  "98:18": {
    "inputs": {
      "noise_seed": 885894517601261
    },
    "class_type": "RandomNoise",
    "_meta": {
      "title": "RandomNoise"
    }
  },
  "98:23": {
    "inputs": {
      "unet_name": "ideogram4_fp8_scaled.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "98:24": {
    "inputs": {
      "text": "{\n    \"high_level_description\": \"A surreal streetwear mixed-media collage poster featuring a relaxed skateboarder mid-air against a vibrant blue sky, backed by giant puffy 3D letters spelling 'COMFY'. The composition blends retro magazine cutout aesthetics with grunge elements like torn paper banners and distressed red stamps, conveying an effortless, cozy vibe.\",\n    \"style_description\": {\n        \"aesthetics\": \"Retro magazine cutout style, mixed-media digital collage, high-contrast streetwear graphic, featuring rough ripped paper edges and distressed grunge textures.\",\n        \"lighting\": \"High-contrast flash mixed with harsh midday sunlight on the skater cutout, contrasting with flat, bright graphic lighting on the 3D typography.\",\n        \"photo\": \"Vintage grainy 35mm film with distressed halftone scan textures and subtle light leaks.\",\n        \"medium\": \"Mixed-media digital collage\",\n        \"color_palette\": [\"#1E73BE\", \"#FDFDFD\", \"#C82A2A\", \"#657C9C\", \"#EFEFEF\"]\n    },\n    \"compositional_deconstruction\": {\n        \"background\": \"A vibrant, clear blue sky layered with a vintage grainy film texture and subtle halftone dot patterns, transitioning down to an implied pale gray concrete ramp at the very bottom edge.\",\n        \"elements\": [\n            {\n                \"type\": \"obj\",\n                \"bbox\": [128, 149, 354, 810],\n                \"desc\": \"Massive 3D puffy, inflatable white typography spelling 'COMFY'. The letters stretch across the upper half of the canvas, acting as a surreal, soft cloud-like backdrop.\",\n                \"color_palette\": [\"#FDFDFD\", \"#E0E0E0\", \"#D3DBE2\"]\n            },\n            {\n                \"type\": \"obj\",\n                \"bbox\": [459, 37, 727, 264],\n                \"desc\": \"A cluster of oversized, distressed red stamped circles and dots, applied loosely to the midground like a grunge ink stamp, partially obscuring the bottom left of the text.\",\n                \"color_palette\": [\"#C82A2A\", \"#A11D1D\"]\n            },\n            {\n                \"type\": \"obj\",\n                \"bbox\": [23, 366, 153, 666],\n                \"desc\": \"A vertically oriented, torn paper side banner pinned to the left edge. The rough-edged paper displays the bold, stamped text 'STAY COZY' in high-contrast black ink.\",\n                \"color_palette\": [\"#EFEFEF\", \"#1A1A1A\", \"#C82A2A\"]\n            },\n            {\n                \"type\": \"obj\",\n                \"bbox\": [287, 210, 756, 819],\n                \"desc\": \"A sharp photographic cutout of a skateboarder mid-air in a relaxed pose. He wears loose-fitting washed denim jeans and a plain white tee, appearing to effortlessly float above the concrete ramp. A distinct white cutout border surrounds his silhouette.\",\n                \"color_palette\": [\"#FDFDFD\", \"#657C9C\", \"#2B2B2B\", \"#DCA57D\"]\n            },\n            {\n                \"type\": \"obj\",\n                \"bbox\": [773, 39, 973, 187],\n                \"desc\": \"A surreal, miniature floating skateboard cutout, positioned playfully in the upper right sky as if defying gravity.\",\n                \"color_palette\": [\"#D2A679\", \"#2B2B2B\", \"#C82A2A\"]\n            },\n            {\n                \"type\": \"obj\",\n                \"bbox\": [105, 830, 905, 980],\n                \"desc\": \"A wide, horizontal strip of heavily textured torn paper spanning the lower third of the composition. It features the bold typographic phrase 'BEYOND THE COMFORT ZONE' intermixed with 'EFFORTLESS RIDE' alongside ripped edges that reveal the background.\",\n                \"color_palette\": [\"#EFEFEF\", \"#1A1A1A\", \"#999999\"]\n            }\n        ]\n    }\n}",
      "clip": [
        "98:14",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Positive Prompt)"
    }
  },
  "98:14": {
    "inputs": {
      "clip_name": "qwen3vl_8b_fp8_scaled.safetensors",
      "type": "ideogram4",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "98:27": {
    "inputs": {
      "value": [
        "37",
        0
      ]
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Int (Width)"
    }
  },
  "98:28": {
    "inputs": {
      "value": [
        "37",
        1
      ]
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "Int (Height)"
    }
  },
  "98:31": {
    "inputs": {
      "expression": "max(((a + 15) // 16) * 16, 256)",
      "values.a": [
        "98:27",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "98:32": {
    "inputs": {
      "expression": "max(((a + 15) // 16) * 16, 256)",
      "values.a": [
        "98:28",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "98:144": {
    "inputs": {
      "value": [
        "98:145",
        0
      ]
    },
    "class_type": "ComfyNumberConvert",
    "_meta": {
      "title": "Convert Number"
    }
  },
  "98:145": {
    "inputs": {
      "json_string": [
        "98:148",
        0
      ],
      "key": "mu"
    },
    "class_type": "JsonExtractString",
    "_meta": {
      "title": "Extract Text from JSON"
    }
  },
  "98:146": {
    "inputs": {
      "value": [
        "98:150",
        0
      ]
    },
    "class_type": "ComfyNumberConvert",
    "_meta": {
      "title": "Convert Number"
    }
  },
  "98:147": {
    "inputs": {
      "json_string": "{\n  \"Quality\": {\n    \"num_steps\": 48,\n    \"mu\": 0.0,\n    \"std\": 1.5,\n    \"preset_id\": \"V4_QUALITY_48\"\n  },\n  \"Default\": {\n    \"num_steps\": 20,\n    \"mu\": 0.0,\n    \"std\": 1.75,\n    \"preset_id\": \"V4_DEFAULT_20\"\n  },\n  \"Turbo\": {\n    \"num_steps\": 12,\n    \"mu\": 0.5,\n    \"std\": 1.75,\n    \"preset_id\": \"V4_TURBO_12\"\n  }\n}",
      "key": [
        "98:156",
        0
      ]
    },
    "class_type": "JsonExtractString",
    "_meta": {
      "title": "Extract Text from JSON"
    }
  },
  "98:148": {
    "inputs": {
      "string": [
        "98:147",
        0
      ],
      "find": "'",
      "replace": "\""
    },
    "class_type": "StringReplace",
    "_meta": {
      "title": "Replace Text"
    }
  },
  "98:149": {
    "inputs": {
      "json_string": [
        "98:148",
        0
      ],
      "key": "num_steps"
    },
    "class_type": "JsonExtractString",
    "_meta": {
      "title": "Extract Text from JSON"
    }
  },
  "98:150": {
    "inputs": {
      "json_string": [
        "98:148",
        0
      ],
      "key": "std"
    },
    "class_type": "JsonExtractString",
    "_meta": {
      "title": "Extract Text from JSON"
    }
  },
  "98:151": {
    "inputs": {
      "value": [
        "98:149",
        0
      ]
    },
    "class_type": "ComfyNumberConvert",
    "_meta": {
      "title": "Convert Number"
    }
  },
  "98:154": {
    "inputs": {
      "unet_name": "ideogram4_unconditional_fp8_scaled.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "98:155": {
    "inputs": {
      "cfg": 7,
      "model": [
        "98:157",
        0
      ],
      "positive": [
        "98:24",
        0
      ],
      "model_negative": [
        "98:154",
        0
      ],
      "negative": [
        "98:10",
        0
      ]
    },
    "class_type": "DualModelGuider",
    "_meta": {
      "title": "Dual Model CFG Guider"
    }
  },
  "98:156": {
    "inputs": {
      "choice": "Default",
      "index": 1,
      "option1": "Quality",
      "option2": "Default",
      "option3": "Turbo",
      "option4": ""
    },
    "class_type": "CustomCombo",
    "_meta": {
      "title": "Custom Combo"
    }
  },
  "98:157": {
    "inputs": {
      "cfg": 3,
      "start_percent": 0.7,
      "end_percent": 1,
      "model": [
        "98:23",
        0
      ]
    },
    "class_type": "CFGOverride",
    "_meta": {
      "title": "CFG Override"
    }
  },
  "134:114": {
    "inputs": {
      "value": "[META]\nfrozen: false\ndescription: Slim single-shot magic prompt \u2014 splatter planning + v15 output discipline, deduped for faster inference. Thinking off.\nthinking_mode: disabled\n\n[SYSTEM]\nYou convert a natural-language user idea into a structured JSON caption an image renderer can consume. You receive the user idea plus a target aspect ratio, and you emit one JSON object.\n\n## OUTPUT CONTRACT \u2014 exactly three top-level keys, in this order:\n\n```json\n{\"aspect_ratio\":\"W:H\",\"high_level_description\":\"...\",\"compositional_deconstruction\":{\"background\":\"...\",\"elements\":[ ... ]}}\n```\n\n- Emit a SINGLE-LINE MINIFIED JSON object \u2014 no markdown fences, no commentary, no other top-level keys.\n- Preserve non-ASCII characters as-is (CJK, Cyrillic, Devanagari, Arabic, accented Latin). Never escape with `\\uNNNN`, transliterate, or replace `caf\u00e9` with `cafe`.\n- Use SINGLE quotes for embedded text references in prose fields (`'Joe's Diner'`, not `\\\"Joe's Diner\\\"`). The `text` field of text elements is the exception \u2014 that field holds the user's verbatim characters, may use any characters, and follows QUOTED SPAN FIDELITY below.\n\n### `aspect_ratio` (first field, always required)\n\nA string in `W:H` form with positive integers (`1:1`, `16:9`, `9:16`, `4:5`, `3:1`, `2:3`, etc.).\n- If the user message gives a concrete `W:H`, echo it verbatim.\n- If the user message says `auto`, pick a concrete ratio that matches the medium and composition (panoramic subjects \u2192 wide ratios like `16:9` or `3:1`; portrait subjects \u2192 tall like `9:16` or `4:5`; designed artifacts \u2192 format conventions like `2:3` book cover, `3:4` poster; ambiguous \u2192 `1:1`). NEVER emit the literal string `auto`.\n- The aspect ratio you commit to drives every bbox decision. Pick it first.\n\n### `high_level_description` \u2014 observational summary (50-word hard cap)\n\n- ONE long sentence preferred, never more than two.\n- Reads like a short natural-language prompt, not an analysis. Starts immediately with the subject \u2014 no \"this image shows\", \"depicts\", \"captures\".\n- Identifies subject(s), medium, and overall composition. Names recognized pop-culture entities by full name (`Nike Air Jordan 1`, `Eiffel Tower`, `Mario (Nintendo character)`).\n- Don't enumerate granular features (every color, every grid dimension, every typography choice). That detail belongs in element descs or `background`.\n- `various`, `multiple`, general categories ARE appropriate here. Specificity rule (below) applies to element descs and `background`, NOT this field.\n- For transparent backgrounds, include the literal phrase `on a transparent background`.\n\nGOOD: `A full-action shot of a male soccer player in a red kit and black Adidas cleats kicking a soccer ball on a green turf field, with a blurred crowd in the stadium background.`\nBAD (over-specifies): `A male soccer player captured mid-kick on a bright green grass pitch, right leg fully extended through the follow-through at the precise moment his black-and-white studded boot makes contact with a white-and-black size-5 ball...`\n\n## ELEMENTS \u2014 what they are, what they're not\n\nEach element is one of:\n```\n{\"type\":\"obj\",\"bbox\":[y1,x1,y2,x2],\"desc\":\"...\"}\n{\"type\":\"text\",\"bbox\":[y1,x1,y2,x2],\"text\":\"LINE ONE\\nLINE TWO\",\"desc\":\"...\"}\n```\n\n`bbox` is optional per-element (see BBOX section below).\n\n### SINGLE SUBJECT = SINGLE ELEMENT\n\nA coherent subject \u2014 one animal, person, vehicle, building, plant, instrument, machine \u2014 is exactly ONE `obj` element. Anatomical and structural parts are descriptive attributes inside that element's `desc`, NOT separate elements.\n\nFORBIDDEN: a bee split into 8 elements (thorax/abdomen/wings/eyes/legs/...); a car split into 6 (body/wheels/windshield/...); a person split into 7 (head/torso/each limb/...); a building split into 5 (foundation/walls/windows/roof/door); a flower split into 3 (petals/stem/leaves).\n\nWhen MULTIPLE distinct subjects appear (a person AND a dog; two bees; three runners), use MULTIPLE elements \u2014 one per subject.\n\n**Test:** part-of-one-thing \u2192 goes in that thing's desc. Separate thing \u2192 its own element.\n\n**Transparent enclosure + featured contents = ONE element.** Display cases, snow globes, terrariums, aquariums, specimen jars, bell jars, vitrines containing a featured subject: name the enclosure + contents as a single unified desc.\n\n**Configured parts + revealed interior = ONE element.** A car with an open door, a machine with raised hood, a building with drawn curtains: the open state and any revealed interior are attributes of the single subject's desc, not separate elements.\n\n### Element desc \u2014 what to write (30\u201360 words, 60-word HARD CAP)\n\nIdentity first, then major attributes briefly, then one distinguishing detail if relevant. Each desc is a standalone catalog entry \u2014 open with the subject's identity, not a referring phrase like \"the X\" that assumes the reader has seen the scene.\n\nGOOD (introduces from scratch):\n- `Woman walking on the platform, medium size. Shoulder-length dark wavy hair, medium skin tone, light blue button-down shirt and grey trousers. Small bag slung over the right shoulder.`\n- `Circular concrete tunnel entrance with glowing blue ring lights along the interior. Train tracks lead directly into the dark opening.`\n\n**Major attributes \u2014 always name:**\n- People: skin tone, hair (color + style), each visible garment with color, expression/gaze, pose, distinguishing feature (mole, glasses, jewelry, held prop).\n- Objects: shape, material, color, distinctive parts (handle, label, logo, marking).\n- Scenes/structures: type, primary material, color, distinctive structural elements.\n\n**Skip (eat word budget for marginal benefit):**\n- Surface-finish micro-prose (`finely granular matte texture with subtle sheen along the elytral ridges`). Pick one short descriptor (matte/glossy/metallic/textured) or omit.\n- Pose mechanics per-limb. Pick ONE summary action phrase plus the major attributes.\n- Camera/shadow/lighting micro-detail per element. Belongs in `background`.\n- Fabric weave, skin texture nuances, micro-anatomy.\n\n### Element desc \u2014 what NOT to include\n\n**No shadows.** Cast shadows, drop shadows, ground shadows, contact shadows, ambient occlusion \u2014 describe in `background` only when scene-wide, otherwise omit (the renderer infers them). Forbidden: `casts a thin hard shadow to the lower right`, `with a soft drop shadow beneath`.\n\n**No camera or render language.** Depth of field, focus, sharpness, bokeh, exposure, motion blur, lens flare, chromatic aberration, film grain \u2014 render properties belong in `high_level_description` or `background` as natural prose ONLY when the user prompt explicitly named them. NEVER inside an obj desc.\n  - EXCEPTION \u2014 viewpoint/angle (`from a low-angle perspective`, `bird's-eye view`, `eye-level`) IS allowed in obj descs when the prompt calls for it. Place once, usually in the focal subject's desc or background.\n\n**No describing impressions instead of physical reality.** Avoid `luminous`, `radiant`, `vibrant`, `lush`, `dynamic`, `glowing` (metaphorically), `gorgeous`, `stunning`, `breathtaking`, `mesmerizing`. Use observable properties: `cheekbone catches a small highlight`, not `luminous complexion`.\n\n**No scene-context repetition per-element.** Lighting direction, ambient surface, mounting context, weather \u2192 describe ONCE in `background`. Each element's desc focuses on what's UNIQUE to that element.\n\n### Anchor placements to named references\n\nSpecify body parts, surfaces, spatial landmarks.\n- CORRECT: `applied to the forehead near the hairline above the left eyebrow`.\n- INCORRECT: `pressed against the skin`.\n- CORRECT: `resting on the lower-right corner of the table directly in front of the laptop`.\n- INCORRECT: `sitting on the surface`.\n\n## BACKGROUND \u2014 what goes here, what doesn't (CRITICAL)\n\n`background` describes the scene SHELL: walls and finishes, floor/ground and surface state, ceiling and architectural fixtures, windows as architecture, atmospheric context (sky, clouds, fog, dust, mist), scene-wide ambient lighting, distant out-of-focus context (horizon, blurred crowds, distant scenery).\n\n### No double-counting\n\nAnything described in `background` CANNOT also appear as an obj element. Each scene component lives in EXACTLY ONE field. Decide once and commit. Before emitting an obj element, scan `background` \u2014 if the component is named there, omit the obj element.\n\n### ALWAYS-BACKGROUND \u2014 these live in `background` only, never as obj elements:\n\n- sky, clouds, atmospheric color\n- horizon\n- distant mountains, hills, tree lines\n- atmospheric weather (fog, haze, mist, smoke)\n- distant cityscape or stadium architecture\n- distant blurred or simplified crowds\n- the floor / ground / turf / paving surface the scene sits on\n- ambient walls or studio backdrop behind focal subjects\n\nYou cannot split these by region. `sky upper-left portion`, `sky behind the fortress`, `sky upper two-thirds` are the SAME component \u2014 describe in `background` once. Same for crowd, ground, horizon.\n\nIf you want technique-level detail on an atmospheric component (watercolor wet-on-wet sky blooms, fog with directional density variation), put that detail in `background`. The `background` field is allowed to be long.\n\n### Ground/floor/pavement is ALWAYS background \u2014 zero tolerance\n\nThe surface the scene sits on \u2014 floor, ground, turf, grass, dirt, sand, asphalt, pavement, road, sidewalk, deck, water surface, snow, tile floor, hardwood, marble \u2014 lives in `background` only. This holds REGARDLESS of how the input formats it: if the prompt lists `Wet rain-slicked pavement below` as a foreground bullet, RE-CLASSIFY it into background.\n\n**Surface character that belongs in background, not as a separate obj:** wet / rain-slicked / mud-streaked / dusty / cracked / polished / weathered surface state; reflective neon pools, fragmented color reflections, puddles, wet patches, mud patches, ice patches, frost, snow on the floor, water pooled on the ground, oil slicks, footprints, tire tracks; surface material (asphalt, cobblestone, hardwood, tile, marble, packed dirt); texture words for the floor (glassy, mirror-like, matte, polished, rough).\n\n**Puddles, reflections, wet patches are part of the ground surface** \u2014 never separate obj elements, regardless of whether they reflect the hero's silhouette or carry visible content.\n\n**Failure mode this prevents:** when a standing hero is the focal element and the floor is also emitted as an obj at the bottom of the frame, the renderer treats the floor obj as a 2D frame band rather than a perspectival receding plane, and clips the hero's legs into it \u2014 figure rendered half-in-the-ground with feet/calves buried.\n\n**Discrete objects ON the floor are still elements:** broken glass shards, crushed cans, scattered debris, leaves, rocks, dropped tools, brick fragments, foreground litter remain obj elements. The rule applies to the SURFACE itself and any state of that surface (wet, frozen, muddy, puddled), never to solid objects resting on it.\n\n### Background is the shell only \u2014 no individually-placeable things\n\nFurniture, vehicles, equipment, people, animals, decor (artwork, signs, plants in pots, stacks of books), free-standing lamps \u2192 obj elements, never `background`.\n\n### Shell-affixed prominent objects \u2192 DUAL MENTION\n\nSome objects are simultaneously part of the shell AND focal elements that define the room's identity: a chalkboard covering the back wall of a classroom, a fireplace built into a living-room wall, a large mounted TV, a stage proscenium, a built-in altar, a built-in bookshelf, a large fixed reception desk, a fixed sign/banner.\n\nFor these, MANDATORY all three steps:\n1. **MENTION in `background`** as part of the shell \u2014 anchors the object to the wall.\n2. **EMIT as an obj element** with the qualifier `\"the primary background element\"` (or similar) at the start of its desc. The obj carries the detail (material, content, frame, mounting).\n3. **PLACE FIRST in the elements list** so painter's-algorithm draws it behind foreground items.\n\nSkipping step 1 (the most common failure) makes the renderer float the object in mid-room or render it in front of foreground subjects.\n\nThis is an EXCEPTION to the shell rule's \"no individually placeable things\". Applies ONLY to objects that genuinely define the room's architectural identity. Free-standing items (chairs, table lamps, plants in pots, framed pictures on a wall) get the normal treatment: elements only, no background mention.\n\n### Recession/arrangement is not architecture\n\nDo not smuggle furniture or people into `background` by describing them as a receding arrangement. Forbidden background phrasings: `rows of desks recede toward the back`, `a grid of desks fills the room`, `students seated at the desks`, `chairs arranged in front of the podium`, `the room is filled with people`, `cars parked along the street`, `customers seated at the tables`. The arrangement IS the foreground content \u2014 emit elements.\n\n### No medium/post-processing effects in background\n\n`background` describes WHAT is in the scene, not HOW it was made. Forbidden in `background` \u2014 even when the prompt names the effect (route those to HLD instead):\n- Film grain, Kodak/Portra/Tri-X grain, ISO noise\n- Lens flare, chromatic aberration, vignetting, bokeh quality\n- Color cast / film-stock shift (warm shift, cool shift)\n- Paper texture, paper grain, canvas texture\n- Brushstroke texture, palette-knife texture\n- Halftone dots, screen-print texture, risograph texture\n\n**Test:** read `background` aloud. If you can picture the EMPTY room from the description \u2014 no furniture, no people, no equipment, no wall decor \u2014 you're in the shell. If anything disappears when you remove the room's contents, the background has leaked.\n\n## BBOX STRATEGY\n\nINCLUDE bboxes on elements where precise positioning matters \u2014 portrait subjects, products on a surface, logos, signs on a wall, distinct individually-placeable objects.\n\nOMIT bboxes on elements that represent dense or hard-to-enumerate visuals \u2014 crowds, fields of wildflowers, scattered particles, starry skies. Per-element judgment.\n\n### Coordinate system\n\nCoordinates are normalized to the target image shape: `x` runs left\u2192right along full width (0 = left edge, 1000 = right), `y` runs top\u2192bottom along full height (0 = top, 1000 = bottom). Top-left origin. Format `[y1, x1, y2, x2]` with `y1 < y2`, `x1 < x2`.\n\n### Shape warning (common failure)\n\nBbox values are normalized to 0\u20131000 in BOTH axes. A square `[0, 0, 500, 500]` is square only on a square frame; on 16:9 it becomes a wide rectangle, on 9:16 a tall rectangle. Most bbox failures (extra subjects, duplicates, mis-scaled objects) come from this mismatch.\n\nFor round objects or square on-screen regions, scale spans so `(x2-x1)/(y2-y1) \u2248 W/H`. For single-subject prompts on wide frames, prefer narrower x-spans. For multi-subject prompts, give each a tight bbox so no one bbox dominates and invites a duplicate.\n\n## SPECIFICITY \u2014 commit to one value\n\nThis JSON feeds a diffusion model. Leave nothing for the model to invent or choose.\n\n**Banned hedge phrasings** (in elements and background): `things like`, `such as`, `e.g.`, `for example`, `or similar`, `various`, `could include`, `might be`, `some kind of`, `style of`. Replace with concrete nouns, counts, colors, materials, poses.\n\n**Banned alternative listings for one property:** `pale institutional off-white or pale green`, `oak or walnut`, `cream or ivory`, `late afternoon or early evening`, `italic serif or italic sans-serif`, `bold or semibold`. Pick ONE and commit. `or` is reserved for the loader's exclusive-choice idiom (`'YES' or 'NO'`), not captioner hedging.\n\n**Typography specifically:** name ONE typeface category (serif OR sans-serif OR display OR script OR monospace), ONE weight (bold/regular/light/medium), ONE style (italic OR upright). Never two joined by `or`.\n\n**Banned \"implied/suggested\" hedges:** `a desk corner implied`, `a chair suggested beneath the figure`, `a building hinted at`, `a shadow that reads as a person`. If it's in the scene, paint it concretely. If it isn't, leave it out. Forbidden words: `implied, suggested, hinted, barely visible, possibly, perhaps, maybe, might be, could be, reads as, almost`.\n\n**Exhaustive content preservation.** When the user provides enumerable content \u2014 schedules, itineraries, lists, menu items, steps, names, times \u2014 every item must appear in the output. Use as many text elements as needed; never sacrifice completeness for layout.\n\n**Named prompt elements MUST appear.** Every explicitly-named visual unit in the user prompt MUST appear as its own element:\n- Input `text:` sections \u2014 every entry becomes its own text element, verbatim. Zero tolerance: 3 entries in input \u2192 \u22653 text elements in output. Empty `text: []` is the only case where text elements may be omitted on that basis.\n- Quoted strings (single or double quotes) \u2014 each is its own text element.\n- Speech bubbles / dialogue callouts / thought bubbles / captions \u2014 each gets a text element for the quoted string AND an obj element for the bubble/balloon/container.\n- Named decorative elements (`small medical cross icon top-left`, `airplane arc trajectory`, `flame-lick flourish at the tail`) \u2014 each gets its own obj.\n- Named badges / chips / CTAs / strips \u2014 each gets its own obj (and text if it carries a quoted string).\n- Named accents / graphic devices (`hairline rule`, `dot grid`, `accent line`, `divider`) \u2014 each gets its own obj UNLESS it's a scene-wide overlay belonging in `background`.\n\n**Test before emitting:** count named visual units in the user prompt; element list must contain at least that many.\n\n**No placeholder enumeration.** When the imagined image contains a sequentially-numbered, alphabetically-labeled, or otherwise individually-identified set (stones numbered 1\u201350, parking spaces A1\u2013A20, place cards `1st`\u2013`12th`, a periodic table of 118 elements, a calendar grid of 31 dates, a 22-name team roster), EACH item is its own element. No `etc.`, no `and so on`, no `6 through 49`, no single obj grouping all into one cluster. List ALL of them.\n\nThe \"dense unenumerable group\" exception (crowd of thousands, field of wildflowers, starry sky) does NOT apply to enumerable sets \u2014 if items are sequentially identified, they're enumerable BY DEFINITION.\n\n**Don't invent visual concepts the user didn't ask for.** Forbidden without explicit user request: `glitch art`, `wireframe overlay`, `mesh that fragments the body`, `digital artifacts`, `dissolved`, `decompose`. If the prompt asks for a cinematic photo of a journalist, render a cinematic photo of a journalist \u2014 not a glitch-art composite.\n\n## PLANNING \u2014 turn the user idea into elements\n\n### 1. Pick a medium\n\n`photograph | illustration | 3D render | graphic design` \u2014 applies as natural-language framing inside HLD/background, NOT as a structured slot.\n\nDecision: **DESIGNED artifact vs CAPTURED / DRAWN / RENDERED moment.**\n- **graphic design** \u2014 poster, book cover, album cover, magazine cover, flyer, banner, social post, sticker, logo, wordmark, packaging, app icon, UI mockup, infographic, menu, greeting card, ticket, signage. If a human designer would sit at a desk to make it.\n- **photograph** \u2014 portrait, landscape, lifestyle, street, sport, wildlife, food, product, fashion editorial (when described as a photograph). Default for ambiguous everyday scenes.\n- **illustration** \u2014 cartoon, anime, manga, comic, watercolor, oil painting, ink, vector, pixel art, children's book illustration, named studios (Ghibli, KyoAni, Pixar 2D).\n- **3D render** \u2014 CGI, octane/unreal/blender, hyperrealistic product render, arch viz, isometric low-poly, voxel, named 3D studios.\n\nSilent / ambiguous \u2192 photograph (default). The subject's reality status does NOT override this default \u2014 wizards, dragons, aliens, robots in a photograph are valid; the brief must explicitly ASK for illustration / painting / render to get one.\n\nImperative verbs at the start (\"Illustrate a\u2026\", \"Paint a\u2026\", \"Draw a\u2026\", \"Render a\u2026\") are NOT medium signals \u2014 they mean \"depict / show\". Default to photograph unless an explicit medium-noun or style name appears.\n\n### 2. Style commitment\n\nInside HLD/background prose, name the style ONCE (`Studio Ghibli animation`, `Pixar 3D animation`, `35mm film photograph`, `iPhone photo`, `editorial digital painting`, `flat vector illustration`). Keep it short \u2014 recognizable style names are enough; the renderer knows them. Don't append technique detail (`with hand-painted gouache backgrounds`) on top of well-known names.\n\n**\"Professional picture/photo/portrait\" of a person means PROFESSIONAL CONTEXT, not professional camera equipment.** Read as corporate headshot, LinkedIn profile, business bio \u2014 neutral business attire, soft even daylight, neutral backdrop, friendly approachable expression. NOT dramatic studio rim-lighting, creamy DSLR bokeh, dark moody backdrop.\n\n### 3. Photoreal defaults \u2014 AVOID \"warm\"\n\nFor photographic prompts (no specified medium beyond `photo`/`photorealistic`/`selfie`/real-world scene):\n- Default to iPhone aesthetic \u2014 phone snapshot, ambient natural light, neutral white balance, accurate (not flattering) skin tones, ordinary framing. AVOID DSLR-magazine markers (creamy bokeh, telephoto compression, dramatic rim lighting, cinematic grade) \u2014 those signal AI-generation.\n- Default lighting framing: `natural daylight`, `overcast daylight`, `diffused daylight`, `cool-neutral white balance`. The word **\"warm\"** (in any phrase: `warm light`, `warm window light`, `warm tone`, `warm grading`) is BANNED as a grading adjective \u2014 it triggers the amber/golden AI look that ruins photorealism. When a scene physically has a warm-coloured light source (candle, sodium streetlamp, sunset), describe the SOURCE concretely (`candle flame`, `sodium streetlamp`) and the colour of the LIGHT POOL (`amber pool from the candle`) \u2014 but the global grade stays neutral.\n- Default composition: prefer non-centered framing (off-center, rule-of-thirds, asymmetrical, leading lines) for portraits, products, single-subject scenes. Use centered framing ONLY when the prompt explicitly calls for it (`centered`, `symmetrical`, `mandala`, `kaleidoscope`) or when the genre is inherently symmetric.\n- No motion blur in candid/realistic/iPhone-aesthetic photos. Motion blur is a craft signature (long-exposure pans, light streaks); using it in a candid signals AI. Real phone snapshots freeze the moment.\n- Saturation: don't stack `vibrant + bright + intense + saturated + electric + neon` for a neutral subject. Mention saturation ONCE (in HLD or background) only when the prompt explicitly asks.\n\n### 4. Populate underspecified scenes\n\nWhen the brief is sparse, don't render only what's explicitly named. Real scenes are populated. Add believable secondary subjects, micro-props that imply the subject's life, environmental texture, small narrative moments. Each invented element should belong in the world the brief implies \u2014 a paddy-field food stall plausibly has a chicken, a sauce bowl, a hand-painted price sign, a lantern.\n\n**Populate by depth layer.** Foreground (often-skipped), midground, background \u2014 each gets its own content. A foreground crop (an out-of-focus leaf at the bottom corner, the rim of a bowl, a fly mid-air close to camera) separates a real photograph from a postcard.\n\n**Commit to a specific cultural / regional identity.** \"Southeast Asian village\" is a hedge that produces generic AI visuals. \"Vietnamese pho stall by the rice paddies outside Hoi An\" is a real place. Specific commitment shapes architecture, signage script, food, dress, props.\n\n**Built environments need text everywhere.** Real shops, stalls, restaurants, vehicles, signage carry text on practically every surface. Generate text generously: shop name sign, sub-signs (`OPEN` / `TODAY'S SPECIAL`), menu board with handwritten items, price labels, jar/bottle labels, name tags, posters, fortune slips, vehicle/equipment labels, sponsor logos. `text: []` is almost always wrong for built environments \u2014 if your scene has a shop/stall/restaurant/workshop/market/vehicle, populate text. Specific content, never `various labels` or `menu items`.\n\n**Override:** when the brief explicitly says `minimal`, `sparse`, `empty`, `lonely`, `isolated`, `quiet`, `still`, `negative space`, `alone`, `single subject`, `in the middle of nowhere`, respect the restraint and skip populate.\n\n**Fantastical / sci-fi / fantasy / futuristic briefs get a populate bonus.** Stack sky drama (galaxies, ringed planets, multiple moons, nebulae), opposing focal points (volcano right / waterfall left), mid-distance scale anchors (crystal columns, futuristic cityscape, megastructures), light/energy effects throughout, exotic architecture/geology, deeply saturated palettes.\n\n## TEXT HANDLING\n\nFor each text element:\n- `text` \u2014 literal characters appearing in the image, verbatim. Preserve diacritics, capitalization, punctuation. Never transliterate or strip.\n- `bbox` \u2014 optional, same coordinate system as obj elements.\n- `desc` \u2014 free-form prose covering size, location, font style, color, orientation, visual effects.\n\n**Sources of text to include:**\n1. **User-quoted text** (single OR double quotes) \u2014 verbatim, exact characters.\n2. **Format-required text** \u2014 headlines, taglines, author names, dates, venues, CTA copy, brand names, publisher marks, edition numbers (when format implies them).\n3. **In-scene contextual text** \u2014 signage, labels, license plates, badges, jersey numbers, t-shirt prints, awnings, neon signs, name tags.\n4. **Numeric content** \u2014 race numbers, jersey numbers, dates, prices, scores, time displays, address numbers. Numbers ARE text.\n5. **Prominent product brand text** \u2014 if an element names a prominent product (bottle, cosmetic, package, beverage) and the user didn't supply a real brand, invent a complete brand identity and list every label as text elements.\n\n**Rules:**\n- Exhaustive: if a viewer could read it, it goes in the list.\n- Each text element appears ONCE in the list. Do NOT also describe its characters in `description` \u2014 refer by role/position instead.\n- Use `\\n` for line breaks WITHIN a single text element (multi-line sign, stacked headline). Use SEPARATE list items for visually distinct text blocks.\n- For stylized hero typography where each letter is a distinct visual unit, stack with `\\n` at natural word breaks \u2014 long single-line stylized titles produce typos and dropped letters. e.g., `\"ENTRE\\nVERSOS E\\nCONTOS\"` not `\"ENTRE VERSOS E CONTOS\"`.\n- **Language scoping:** `scene`/`elements`/`description`/position descriptors are always in ENGLISH regardless of the user's brief language. Only the literal `text` field characters follow the user's brief language. Portuguese brief \u2192 English prose + Portuguese `text:` content.\n\n## POP CULTURE, BRANDS, NAMED REFERENCES\n\nWhen the user idea names or clearly implies a brand, trademark, product (sneaker/car/device), public figure, athlete, musician, actor, fictional character, film, show, game, franchise, team \u2014 the output MUST carry an explicit named reference in the relevant element `desc`, not a generic stand-in describing the look.\n\nDon't replace `Nike Dunk Low Panda` with `black and white retro sneakers`, `Spider-Man` with `a red-and-blue masked superhero`, `The Beatles` with `four men in matching suits` \u2014 unless the user asked for an anonymous lookalike. Name the specific thing the user pointed at.\n\n## TRANSPARENT BACKGROUND\n\nIf the user's idea calls for transparent background, transparent canvas, alpha channel, cutout/isolated subject, sticker-style with no backdrop, or similar, the `background` field MUST be exactly this string, verbatim and nothing else: `transparent background`\n\nDo not paraphrase (no `clear backdrop`, `empty alpha`, `no background`, `PNG transparency`).\n\nIn `high_level_description`, include the literal phrase `on a transparent background`.\n\n[USER]\nTARGET IMAGE ASPECT RATIO: {{width}}:{{height}} (width:height).\nUser idea: {{original_prompt}}"
    },
    "class_type": "PrimitiveStringMultiline",
    "_meta": {
      "title": "System Prompt"
    }
  },
  "134:115": {
    "inputs": {
      "value": "A surreal streetwear mixed-media collage poster featuring a relaxed skateboarder mid-air against a vibrant blue sky, backed by giant puffy 3D letters spelling 'COMFY'. The composition blends retro magazine cutout aesthetics with grunge elements like torn paper banners and distressed red stamps, conveying "
    },
    "class_type": "PrimitiveStringMultiline",
    "_meta": {
      "title": "User Prompt"
    }
  },
  "134:163": {
    "inputs": {
      "string": [
        "134:114",
        0
      ],
      "find": "{{original_prompt}}",
      "replace": [
        "134:115",
        0
      ]
    },
    "class_type": "StringReplace",
    "_meta": {
      "title": "Replace Text"
    }
  },
  "134:164": {
    "inputs": {
      "source": [
        "134:166",
        1
      ]
    },
    "class_type": "PreviewAny",
    "_meta": {
      "title": "Preview as Text"
    }
  },
  "134:165": {
    "inputs": {
      "source": [
        "134:167",
        1
      ]
    },
    "class_type": "PreviewAny",
    "_meta": {
      "title": "Preview as Text"
    }
  },
  "134:166": {
    "inputs": {
      "expression": "max(((a + 15) // 16) * 16, 256)",
      "values.a": [
        "37",
        0
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "134:167": {
    "inputs": {
      "expression": "max(((a + 15) // 16) * 16, 256)",
      "values.a": [
        "37",
        1
      ]
    },
    "class_type": "ComfyMathExpression",
    "_meta": {
      "title": "Math Expression"
    }
  },
  "134:169": {
    "inputs": {
      "string": [
        "134:163",
        0
      ],
      "find": "{{width}}",
      "replace": [
        "134:164",
        0
      ]
    },
    "class_type": "StringReplace",
    "_meta": {
      "title": "Replace Text"
    }
  },
  "134:170": {
    "inputs": {
      "string": [
        "134:169",
        0
      ],
      "find": "{{height}}",
      "replace": [
        "134:165",
        0
      ]
    },
    "class_type": "StringReplace",
    "_meta": {
      "title": "Replace Text"
    }
  }
};

// Upscalers disponibles en ComfyUI (carpeta upscale_models)
export const UPSCALERS: Record<string, string> = {
  ultrasharp: "4x-UltraSharp.pth",
  realesrgan: "RealESRGAN_x4plus.pth",
};

// Inyecta nodos de upscale en un workflow y redirige SaveImage al resultado
function applyUpscale(
  wf: Record<string, any>,
  saveNodeId: string,
  upscale?: string
): Record<string, any> {
  const modelName = upscale ? UPSCALERS[upscale] : undefined;
  if (!modelName) return wf;

  const saveNode = wf[saveNodeId];
  if (!saveNode) return wf;

  const sourceImage = saveNode.inputs.images;

  wf["30"] = { class_type: "UpscaleModelLoader", inputs: { model_name: modelName } };
  wf["31"] = {
    class_type: "ImageUpscaleWithModel",
    inputs: { upscale_model: ["30", 0], image: sourceImage },
  };
  saveNode.inputs.images = ["31", 0];

  return wf;
}

export const GENERATORS: Record<ImageGenerator, GeneratorConfig> = {
  "flux-dev": {
    id: "flux-dev",
    name: "FLUX Dev",
    description: "FLUX.1-dev FP8 - 24B parámetros, texto a imagen",
    emoji: "🌀",
    defaultParams: { width: 1024, height: 1024, steps: 20, cfg: 1.0, sampler: "euler", scheduler: "simple", upscale: "ninguno" },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "steps", label: "Pasos", type: "number", default: 20, min: 1, max: 100, step: 1 },
      { id: "cfg", label: "CFG", type: "number", default: 1.0, min: 0.5, max: 30, step: 0.5 },
      { id: "sampler", label: "Sampler", type: "select", default: "euler", options: [
        { value: "euler", label: "Euler" }, { value: "heun", label: "Heun" }, { value: "dpm_2", label: "DPM2" },
        { value: "dpmpp_2m", label: "DPM++ 2M" }, { value: "dpmpp_2s", label: "DPM++ 2S" }, { value: "lcm", label: "LCM" },
      ]},
      { id: "scheduler", label: "Scheduler", type: "select", default: "simple", options: [
        { value: "simple", label: "Simple" }, { value: "normal", label: "Normal" }, { value: "karras", label: "Karras" },
        { value: "exponential", label: "Exponential" }, { value: "sgm_uniform", label: "SGM Uniform" },
      ]},
      { id: "upscale", label: "Upscale", type: "select", default: "ninguno", options: [
        { value: "ninguno", label: "Ninguno" }, { value: "ultrasharp", label: "4x UltraSharp (detalle)" }, { value: "realesrgan", label: "4x RealESRGAN (fotorrealista)" },
      ]},
    ],
    buildWorkflow(prompt, p, negative = "") {
      const wf = {
        "3": { class_type: "KSampler", inputs: { seed: seed(), steps: p.steps, cfg: p.cfg, sampler_name: String(p.sampler), scheduler: String(p.scheduler), denoise: 1.0, model: ["10", 0], positive: ["6", 0], negative: ["13", 0], latent_image: ["5", 0] } },
        "5": { class_type: "EmptySD3LatentImage", inputs: { width: alignRes(Number(p.width)), height: alignRes(Number(p.height)), batch_size: 1 } },
        "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["10", 1] } },
        "13": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["10", 1] } },
        "10": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "flux1-dev-fp8.safetensors" } },
        "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["10", 2] } },
        "9": { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: "saas_hub" } },
      };
      return applyUpscale(wf, "9", String(p.upscale));
    },
  },

  "flux-schnell": {
    id: "flux-schnell",
    name: "FLUX Schnell",
    description: "FLUX.1-schnell FP8 - Apache 2.0, uso comercial libre, 4 pasos (rápido)",
    emoji: "⚡",
    defaultParams: { width: 1024, height: 1024, steps: 4, cfg: 1.0, sampler: "euler", scheduler: "simple", upscale: "ninguno" },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "steps", label: "Pasos", type: "number", default: 4, min: 1, max: 8, step: 1 },
      { id: "cfg", label: "CFG", type: "number", default: 1.0, min: 0.5, max: 30, step: 0.5 },
      { id: "sampler", label: "Sampler", type: "select", default: "euler", options: [
        { value: "euler", label: "Euler" }, { value: "heun", label: "Heun" }, { value: "dpm_2", label: "DPM2" },
        { value: "dpmpp_2m", label: "DPM++ 2M" }, { value: "dpmpp_2s", label: "DPM++ 2S" },
      ]},
      { id: "scheduler", label: "Scheduler", type: "select", default: "simple", options: [
        { value: "simple", label: "Simple" }, { value: "normal", label: "Normal" }, { value: "karras", label: "Karras" },
        { value: "exponential", label: "Exponential" }, { value: "sgm_uniform", label: "SGM Uniform" },
      ]},
      { id: "upscale", label: "Upscale", type: "select", default: "ninguno", options: [
        { value: "ninguno", label: "Ninguno" }, { value: "ultrasharp", label: "4x UltraSharp (detalle)" }, { value: "realesrgan", label: "4x RealESRGAN (fotorrealista)" },
      ]},
    ],
    buildWorkflow(prompt, p, negative = "") {
      const wf = {
        "3": { class_type: "KSampler", inputs: { seed: seed(), steps: p.steps, cfg: p.cfg, sampler_name: String(p.sampler), scheduler: String(p.scheduler), denoise: 1.0, model: ["10", 0], positive: ["6", 0], negative: ["13", 0], latent_image: ["5", 0] } },
        "5": { class_type: "EmptySD3LatentImage", inputs: { width: alignRes(Number(p.width)), height: alignRes(Number(p.height)), batch_size: 1 } },
        "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["10", 1] } },
        "13": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["10", 1] } },
        "10": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "flux1-schnell-fp8.safetensors" } },
        "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["10", 2] } },
        "9": { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: "saas_hub" } },
      };
      return applyUpscale(wf, "9", String(p.upscale));
    },
  },

  "ideogram-4": {
    id: "ideogram-4",
    name: "Ideogram 4",
    description: "Ideogram 4 oficial (UNET dual + Qwen3VL CLIP + JSON struct) - flujo exacto de ComfyUI",
    emoji: "🎯",
    defaultParams: { width: 1024, height: 1024, preset: "Default", upscale: "ninguno" },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "preset", label: "Calidad", type: "select", default: "Default", options: [
        { value: "Quality", label: "Máxima (48 pasos, ~120s)" },
        { value: "Default", label: "Default (20 pasos, ~80s)" },
        { value: "Turbo", label: "Turbo (12 pasos, ~50s)" },
      ]},
      { id: "upscale", label: "Upscale", type: "select", default: "ninguno", options: [
        { value: "ninguno", label: "Ninguno" }, { value: "ultrasharp", label: "4x UltraSharp (detalle)" }, { value: "realesrgan", label: "4x RealESRGAN (fotorrealista)" },
      ]},
    ],
    buildWorkflow(prompt, p, _negative = "") {
      const wf = JSON.parse(JSON.stringify(IDEOGRAM_4_WORKFLOW));
      
      const s = Math.floor(Math.random() * 2 ** 32);
      
      // Actualizar semilla en RandomNoise (nodo 98:18)
      if (wf["98:18"]) {
        wf["98:18"].inputs.noise_seed = s;
      }
      
      // Actualizar User Prompt (nodo 134:115)
      if (wf["134:115"]) {
        wf["134:115"].inputs.value = (p.rawUserPrompt as string) || prompt;
      }
      
      // Actualizar Positive Prompt (nodo 98:24)
      if (wf["98:24"]) {
        wf["98:24"].inputs.text = prompt;
      }
      
      // Actualizar Calidad (nodo 98:156)
      if (wf["98:156"]) {
        wf["98:156"].inputs.choice = String(p.preset || "Default");
      }
      
      // Actualizar aspect ratio en ResolutionSelector (nodo 37)
      const w = Number(p.width) || 1024;
      const h = Number(p.height) || 1024;
      let aspectRatioStr = "1:1 (Square)";
      if (w > h) {
        aspectRatioStr = "16:9 (Landscape Widescreen)";
      } else if (w < h) {
        aspectRatioStr = "9:16 (Portrait Widescreen)";
      }
      
      if (wf["37"]) {
        wf["37"].inputs.aspect_ratio = aspectRatioStr;
      }
      
      return applyUpscale(wf, "158", String(p.upscale));
    },
  },

  "flux-2-klein": {
    id: "flux-2-klein",
    name: "FLUX 2 Klein",
    description: "FLUX 2 Klein 9B FP8 - modelo más reciente, 9B parámetros",
    emoji: "✨",
    defaultParams: { width: 1024, height: 1024, steps: 20, cfg: 1.0, sampler: "euler", scheduler: "simple", weight_dtype: "default", upscale: "ninguno" },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "steps", label: "Pasos", type: "number", default: 20, min: 1, max: 100, step: 1 },
      { id: "cfg", label: "CFG", type: "number", default: 1.0, min: 0.5, max: 30, step: 0.5 },
      { id: "sampler", label: "Sampler", type: "select", default: "euler", options: [
        { value: "euler", label: "Euler" }, { value: "heun", label: "Heun" }, { value: "dpm_2", label: "DPM2" }, { value: "dpmpp_2m", label: "DPM++ 2M" },
      ]},
      { id: "scheduler", label: "Scheduler", type: "select", default: "simple", options: [
        { value: "simple", label: "Simple" }, { value: "normal", label: "Normal" }, { value: "karras", label: "Karras" },
      ]},
      { id: "weight_dtype", label: "Precisión", type: "select", default: "default", options: [
        { value: "default", label: "Default" }, { value: "fp8_e4m3fn", label: "FP8 E4M3" }, { value: "fp8_e4m3fn_fast", label: "FP8 E4M3 Fast" },
      ]},
      { id: "upscale", label: "Upscale", type: "select", default: "ninguno", options: [
        { value: "ninguno", label: "Ninguno" }, { value: "ultrasharp", label: "4x UltraSharp (detalle)" }, { value: "realesrgan", label: "4x RealESRGAN (fotorrealista)" },
      ]},
    ],
    buildWorkflow(prompt, p, negative = "") {
      const wf = {
        "3": { class_type: "KSampler", inputs: { seed: seed(), steps: p.steps, cfg: p.cfg, sampler_name: String(p.sampler), scheduler: String(p.scheduler), denoise: 1.0, model: ["10", 0], positive: ["6", 0], negative: ["13", 0], latent_image: ["5", 0] } },
        "5": { class_type: "EmptySD3LatentImage", inputs: { width: alignRes(Number(p.width)), height: alignRes(Number(p.height)), batch_size: 1 } },
        "10": { class_type: "UNETLoader", inputs: { unet_name: "flux-2-klein-9b-fp8.safetensors", weight_dtype: String(p.weight_dtype) } },
        "14": { class_type: "DualCLIPLoader", inputs: { clip_name1: "t5xxl_fp16.safetensors", clip_name2: "clip_l.safetensors", type: "flux" } },
        "15": { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
        "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["14", 0] } },
        "13": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["14", 0] } },
        "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["15", 0] } },
        "9": { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: "saas_hub" } },
      };
      return applyUpscale(wf, "9", String(p.upscale));
    },
  },

  "realvis-xl": {
    id: "realvis-xl",
    name: "RealVis XL Turbo",
    description: "RealVis XL 3.0 Turbo - SDXL, fotorealista, 6 pasos",
    emoji: "📸",
    defaultParams: { width: 1024, height: 1024, steps: 6, cfg: 3.5, sampler: "euler", scheduler: "normal", upscale: "ninguno" },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 512, max: 2048, step: 64 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 512, max: 2048, step: 64 },
      { id: "steps", label: "Pasos", type: "number", default: 6, min: 1, max: 50, step: 1 },
      { id: "cfg", label: "CFG", type: "number", default: 3.5, min: 1, max: 30, step: 0.5 },
      { id: "sampler", label: "Sampler", type: "select", default: "euler", options: [
        { value: "euler", label: "Euler" }, { value: "dpmpp_2m", label: "DPM++ 2M" }, { value: "lcm", label: "LCM" },
        { value: "dpmpp_sde", label: "DPM++ SDE" },
      ]},
      { id: "scheduler", label: "Scheduler", type: "select", default: "normal", options: [
        { value: "normal", label: "Normal" }, { value: "karras", label: "Karras" }, { value: "sgm_uniform", label: "SGM Uniform" },
      ]},
      { id: "upscale", label: "Upscale", type: "select", default: "ninguno", options: [
        { value: "ninguno", label: "Ninguno" }, { value: "ultrasharp", label: "4x UltraSharp (detalle)" }, { value: "realesrgan", label: "4x RealESRGAN (fotorrealista)" },
      ]},
    ],
    buildWorkflow(prompt, p, negative = "") {
      const wf = {
        "3": { class_type: "KSampler", inputs: { seed: seed(), steps: p.steps, cfg: p.cfg, sampler_name: String(p.sampler), scheduler: String(p.scheduler), denoise: 1.0, model: ["10", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] } },
        "5": { class_type: "EmptyLatentImage", inputs: { width: alignRes(Number(p.width)), height: alignRes(Number(p.height)), batch_size: 1 } },
        "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["10", 1] } },
        "7": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["10", 1] } },
        "10": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "RealVisXL_V3.0_Turbo.safetensors" } },
        "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["10", 2] } },
        "9": { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: "saas_hub" } },
      };
      return applyUpscale(wf, "9", String(p.upscale));
    },
  },

  "z-image-turbo": {
    id: "z-image-turbo",
    name: "Z-Image-Turbo",
    description: "Z-Image-Turbo - modelo rápido (4-8 pasos) con soporte de texto y alta fidelidad",
    emoji: "🚀",
    defaultParams: { width: 1024, height: 1024, steps: 4, cfg: 1.0, sampler: "res_multistep", scheduler: "simple", upscale: "ninguno" },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "steps", label: "Pasos", type: "number", default: 4, min: 1, max: 24, step: 1 },
      { id: "cfg", label: "CFG", type: "number", default: 1.0, min: 1.0, max: 10.0, step: 0.5 },
      { id: "sampler", label: "Sampler", type: "select", default: "res_multistep", options: [
        { value: "res_multistep", label: "Res Multistep" },
        { value: "euler", label: "Euler" },
        { value: "dpmpp_2m", label: "DPM++ 2M" },
      ]},
      { id: "scheduler", label: "Scheduler", type: "select", default: "simple", options: [
        { value: "simple", label: "Simple" },
        { value: "normal", label: "Normal" },
        { value: "karras", label: "Karras" },
      ]},
      { id: "upscale", label: "Upscale", type: "select", default: "ninguno", options: [
        { value: "ninguno", label: "Ninguno" }, { value: "ultrasharp", label: "4x UltraSharp (detalle)" }, { value: "realesrgan", label: "4x RealESRGAN (fotorrealista)" },
      ]},
    ],
    buildWorkflow(prompt, p, negative = "") {
      const w = alignRes(Number(p.width) || 1024);
      const h = alignRes(Number(p.height) || 1024);
      const s = seed();

      const wf = {
        "1": { class_type: "CLIPLoader", inputs: { clip_name: "qwen_3_4b.safetensors", type: "ideogram4", device: "default" } },
        "2": { class_type: "UNETLoader", inputs: { unet_name: "z_image_turbo_bf16.safetensors", weight_dtype: "default" } },
        "3": { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
        "4": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 0], text: prompt } },
        "5": { class_type: "ConditioningZeroOut", inputs: { conditioning: ["4", 0] } },
        "6": { class_type: "ModelSamplingAuraFlow", inputs: { model: ["2", 0], shift: 3.0 } },
        "7": { class_type: "EmptySD3LatentImage", inputs: { width: w, height: h, batch_size: 1 } },
        "8": { class_type: "KSampler", inputs: { seed: s, control_after_generate: "randomize", steps: p.steps, cfg: p.cfg, sampler_name: String(p.sampler), scheduler: String(p.scheduler), denoise: 1.0, model: ["6", 0], positive: ["4", 0], negative: ["5", 0], latent_image: ["7", 0] } },
        "9": { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["3", 0] } },
        "10": { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: "saas_hub" } },
      };
      return applyUpscale(wf, "10", String(p.upscale));
    },
  },
  "gemini-3.1-flash-lite-image": {
    id: "gemini-3.1-flash-lite-image",
    name: "Nano Banana 2 Lite",
    description: "Gemini 3.1 Flash Lite - Más rápido y ultra-económico",
    emoji: "⚡",
    defaultParams: { width: 1024, height: 1024 },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
    ],
    buildWorkflow(prompt, p, _negative = "") {
      return {};
    }
  },
  "gemini-3.1-flash-image": {
    id: "gemini-3.1-flash-image",
    name: "Nano Banana 2",
    description: "Gemini 3.1 Flash - Balance ideal entre calidad y velocidad",
    emoji: "🍌",
    defaultParams: { width: 1024, height: 1024 },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
    ],
    buildWorkflow(prompt, p, _negative = "") {
      return {};
    }
  },
  "gemini-3-pro-image": {
    id: "gemini-3-pro-image",
    name: "Nano Banana Pro",
    description: "Gemini 3 Pro - Calidad premium y máximo realismo",
    emoji: "💎",
    defaultParams: { width: 1024, height: 1024 },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
    ],
    buildWorkflow(prompt, p, _negative = "") {
      return {};
    }
  },
  "gemini-2.5-flash-image": {
    id: "gemini-2.5-flash-image",
    name: "Nano Banana Legacy",
    description: "Gemini 2.5 Flash - Compatible con velocidad rápida",
    emoji: "⏱️",
    defaultParams: { width: 1024, height: 1024 },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 256, max: 2048, step: 16 },
    ],
    buildWorkflow(prompt, p, _negative = "") {
      return {};
    }
  },
  "dall-e-3": {
    id: "dall-e-3",
    name: "DALL-E 3",
    description: "OpenAI DALL-E 3 - Máxima calidad y coherencia de texto",
    emoji: "🟢",
    defaultParams: { width: 1024, height: 1024, quality: "standard" },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 1024, max: 1024, step: 1024 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 1024, max: 1024, step: 1024 },
      { id: "quality", label: "Calidad", type: "select", default: "standard", options: [
        { value: "standard", label: "Estándar" },
        { value: "hd", label: "Alta Definición (HD)" }
      ]}
    ],
    buildWorkflow(prompt, p, _negative = "") {
      return {};
    }
  },
  "dall-e-2": {
    id: "dall-e-2",
    name: "DALL-E 2",
    description: "OpenAI DALL-E 2 - Rápido y económico para borradores",
    emoji: "🎨",
    defaultParams: { width: 1024, height: 1024 },
    params: [
      { id: "width", label: "Ancho", type: "number", default: 1024, min: 256, max: 1024, step: 256 },
      { id: "height", label: "Alto", type: "number", default: 1024, min: 256, max: 1024, step: 256 }
    ],
    buildWorkflow(prompt, p, _negative = "") {
      return {};
    }
  },
};

// Estilos de imagen disponibles
export const IMAGE_STYLES = [
  { value: "ninguno", label: "Sin estilo específico", prompt: "" },
  { value: "realista", label: "Fotográfico Realista", prompt: "realistic photograph of real people, authentic candid shot, ultra detailed, sharp focus, natural lighting, depth of field, realistic skin textures, raw photo" },
  { value: "cinematografico", label: "Cinematográfico", prompt: "cinematic photograph, cinematic lighting, dramatic composition, film grain, anamorphic lens flare, movie scene look" },
  { value: "animado", label: "Animado / Cartoon", prompt: "animated style, cartoon, vibrant colors, clean outlines, digital illustration" },
  { value: "pintura", label: "Pintura al Óleo", prompt: "oil painting style, visible brushstrokes, canvas texture, rich color palette, classical art look" },
  { value: "acuarela", label: "Acuarela", prompt: "watercolor painting style, soft colors, bleeding edges, textured paper, hand-painted aesthetic" },
  { value: "3d", label: "3D / Render", prompt: "3D render, global illumination, photorealistic textures, soft shadows, depth, octane render style" },
  { value: "retro", label: "Retro / Vintage", prompt: "retro style, vintage look, nostalgic filter, faded desaturated colors, 1980s aesthetic" },
  { value: "minimalista", label: "Minimalista", prompt: "minimalist style, simple composition, clean backgrounds, negative space, elegant layout" },
  { value: "noir", label: "Noir / Blanco y Negro", prompt: "black and white, high contrast, deep shadows, dramatic lighting, film noir aesthetic" },
  { value: "ciberpunk", label: "Ciberpunk / Neón", prompt: "cyberpunk style, neon lights, glowing color accents, dark night atmosphere, futuristic city vibes" },
];

// Convierte un código de color hexadecimal a una descripción en lenguaje natural en español
export function hexToColorName(hex: string): string {
  if (!hex) return "";
  let cleanHex = hex.trim().replace(/^#/, "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map(c => c + c).join("");
  }
  if (cleanHex.length !== 6) {
    return hex; // Devolver original si no es un hex válido
  }

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  const hueDegrees = h * 360;

  // Clasificación de color base
  if (l < 0.1) return "negro";
  if (l > 0.9) return "blanco";
  if (s < 0.15) {
    if (l < 0.35) return "gris oscuro";
    if (l > 0.65) return "gris claro";
    return "gris";
  }

  let colorName = "";
  if ((hueDegrees >= 0 && hueDegrees < 15) || hueDegrees >= 345) {
    colorName = "rojo";
  } else if (hueDegrees >= 15 && hueDegrees < 45) {
    colorName = "naranja";
  } else if (hueDegrees >= 45 && hueDegrees < 70) {
    colorName = "amarillo";
  } else if (hueDegrees >= 70 && hueDegrees < 160) {
    colorName = "verde";
  } else if (hueDegrees >= 160 && hueDegrees < 200) {
    colorName = "celeste cian";
  } else if (hueDegrees >= 200 && hueDegrees < 250) {
    colorName = "azul";
  } else if (hueDegrees >= 250 && hueDegrees < 290) {
    colorName = "púrpura violeta";
  } else if (hueDegrees >= 290 && hueDegrees < 345) {
    colorName = "rosa fucsia";
  }

  // Refinamiento con saturación y luminosidad
  if (l < 0.35) {
    return `${colorName} oscuro`;
  } else if (l > 0.7) {
    return `${colorName} claro`;
  } else if (s > 0.8) {
    return `${colorName} brillante`;
  }

  return colorName;
}

// Construye un prompt estructurado en JSON para Ideogram 4
// Sigue el formato oficial: high_level_description + style_description + compositional_deconstruction
export function buildIdeogramPrompt(
  subject: string,
  text: string,
  styleValue: string,
  details: string,
  width: number = 1024,
  height: number = 1024,
  textStylePreset: string = "modern-white",
  subtitle: string = "",
  subtitleStyle: string = "clean-white",
  bullets: string = ""
): string {
  // Calcular aspect ratio
  const g = gcd(width, height);
  const aspectRatio = `${width / g}:${height / g}`;

  const style = IMAGE_STYLES.find((s) => s.value === styleValue);
  const cleanedText = text.trim().replace(/"/g, "'");

  // Construir elementos
  const elements: any[] = [];

  // Elemento principal: el sujeto
  if (subject.trim()) {
    elements.push({
      type: "obj",
      desc: subject.trim(),
    });
  }

  // Elemento de texto si se especificó
  if (cleanedText) {
    let styleText = "";
    if (textStylePreset === "modern-white") {
      styleText = "written in a clean modern bold sans-serif font of pure white color, with a soft black drop shadow for high contrast and perfect readability";
    } else if (textStylePreset === "sticker-black") {
      styleText = "printed in clean solid black sans-serif lettering inside a bright yellow or white rectangular block style banner/sticker";
    } else if (textStylePreset === "neon-glow") {
      styleText = "rendered as vibrant neon glowing letters of electric cyan or hot pink hue, emitting soft ambient light on the surrounding area";
    } else if (textStylePreset === "luxury-gold") {
      styleText = "crafted as classic elegant serif letters with a 3D shiny polished gold metallic texture, showing light reflections and premium feel";
    } else if (textStylePreset === "3d-inflated") {
      styleText = "designed as volumetric 3D inflated bubble letters with glossy plastic finish, bright contrasting colors and friendly soft round corners";
    } else {
      styleText = "written clearly and legibly with a clean font design and high contrast";
    }

    elements.push({
      type: "text",
      text: cleanedText,
      desc: `Main title text spelling exactly "${cleanedText}", ${styleText}, with razor-sharp contours, perfectly formed font glyphs, flawless letter geometry, high legibility, zero deformed characters, prominently positioned`,
    });
  }

  // Elemento de subtítulo si se especificó
  if (subtitle.trim()) {
    const cleanedSubtitle = subtitle.trim().replace(/"/g, "'");
    let styleText = "";
    if (subtitleStyle === "clean-white") {
      styleText = "written in a clean, neat modern sans-serif font of pure white color, smaller than the main title, with sharp contrast, perfectly formed letters and high readability";
    } else if (subtitleStyle === "clean-black") {
      styleText = "written in a clean, neat modern sans-serif font of solid black color, smaller than the main title, with high contrast, sharp contours and high readability";
    } else if (subtitleStyle === "soft-gray") {
      styleText = "written in a modern sans-serif font of elegant light gray or silver color, smaller than the main title, subtle, sharp and premium";
    } else if (subtitleStyle === "neon-glow") {
      styleText = "rendered in sharp neon glowing letters of cyan or hot pink, smaller than the main title, well-defined letter shapes emitting soft neon light";
    } else {
      styleText = "written clearly and legibly with clean typography and perfectly formed letters";
    }

    elements.push({
      type: "text",
      text: cleanedSubtitle,
      desc: `Subtitle text spelling exactly "${cleanedSubtitle}", positioned directly below or near the main title, ${styleText}`,
    });
  }

  // Características / Viñetas
  if (bullets.trim()) {
    const bulletList = bullets.split(",").map(b => b.trim()).filter(Boolean);
    if (bulletList.length > 0) {
      const listDesc = bulletList.map(b => `"${b}"`).join(", ");
      elements.push({
        type: "text",
        text: bulletList.join(" | "),
        desc: `A vertical list of feature bullet points displaying ${listDesc}, written in small, crisp, highly legible clean sans-serif white or black letters with sharp well-formed glyphs, positioned in the bottom-left or bottom area of the layout`,
      });
    }
  }

  // Background
  const background = details.trim()
    || `${style ? style.prompt.split(",")[0] + " atmosphere" : "Clean, well-lit professional background"}`
    || "Clean, professional background with balanced lighting";

  // Style description
  const styleDescription: any = {};
  if (style && style.prompt) {
    styleDescription.aesthetics = style.prompt;
  }

  // High-level description
  let hld = subject.trim();
  if (cleanedText) hld += ` featuring the text "${cleanedText}"`;
  if (style) hld += `, ${style.prompt.split(",")[0]}`;
  if (details.trim()) hld += `, ${details.trim().toLowerCase()}`;

  const jsonObj: any = {
    aspect_ratio: aspectRatio,
    high_level_description: hld,
    compositional_deconstruction: {
      background,
      elements,
    },
  };

  if (Object.keys(styleDescription).length > 0) {
    jsonObj.style_description = styleDescription;
  }

  return JSON.stringify(jsonObj);
}

// Construye un prompt plano y jerarquizado (para Z-Image-Turbo, FLUX, RealVis, etc.)
export function buildRichPrompt(
  subject: string,
  text: string,
  styleValue: string,
  details: string,
  textLayout: string = "ninguno",
  dailyVariation: string = "ninguno",
  textStylePreset: string = "modern-white",
  subtitle: string = "",
  subtitleStyle: string = "clean-white",
  bullets: string = "",
  brandContext?: {
    name: string;
    guidelines: string;
    voiceTone: string;
    projectDescription?: string;
    targetAudience?: string;
    valueProposition?: string;
    styleAspects?: string;
    colors: { primary: string[]; secondary: string[] };
    typography: { heading: string; body: string };
  },
  generatorId?: ImageGenerator
): string {
  const parts: string[] = [];

  // Limpiar palabras venenosas para modelos de difusión ("flyer", "folleto", "cartel", "brochure", "mockup", "ui", "interface")
  // Estas palabras provocan que el modelo genere un trozo de papel arrugado con letras ilegibles o interfaces falsas.
  const cleanSubject = subject
    .replace(/\b(un|el|los|las|una)?\s*(flyer|folleto|cartel|brochure|banner|afiche|poster)\s*(de|para|promocional|publicitario)?\b/gi, "")
    .replace(/\b(diseño|diseño de|diseño publicitario|interfaz|mockup|ui|website mockup)\b/gi, "")
    .trim();

  // 1. Determinar el medio o estilo fotográfico base
  let stylePrompt = "A professional commercial photograph";
  if (styleValue && styleValue !== "ninguno") {
    const style = IMAGE_STYLES.find((s) => s.value === styleValue);
    if (style && style.prompt) {
      stylePrompt = style.prompt;
    }
  }

  // 2. Establecer el estilo y el sujeto al principio del prompt
  if (cleanSubject) {
    if (stylePrompt) {
      parts.push(`${stylePrompt} of ${cleanSubject}`);
    } else {
      parts.push(cleanSubject);
    }
  } else if (stylePrompt) {
    parts.push(stylePrompt);
  }

  // 2.5 Regla estricta para fotos realistas y cinematográficas (evitar mockups / interfaces flotantes)
  if (styleValue === "realista" || styleValue === "cinematografico" || !styleValue || styleValue === "ninguno") {
    parts.push("authentic candid real-world scene, realistic skin textures and natural lighting, shot on 35mm lens, f/1.8, 8k resolution");
  }

  // 3. Posicionamiento espacial y contenedor gráfico (CRÍTICO para flyers con formas y diseño publicitario)
  let spatialPosition = "in the clean empty negative space on the upper side";
  if (textLayout === "arriba") {
    spatialPosition = "in the upper empty space above the subject";
  } else if (textLayout === "abajo") {
    spatialPosition = "in the lower empty space below the subject";
  } else if (textLayout === "centro") {
    spatialPosition = "in the central clean negative space";
  } else {
    spatialPosition = "in the clean empty space on the opposite side of the subject";
  }

  // 4. Integración concisa de colores de marca (evitando sobrecarga de tokens)
  if (brandContext && (brandContext.colors?.primary?.length || brandContext.colors?.secondary?.length)) {
    const primNames = brandContext.colors.primary.map(hexToColorName).filter(Boolean).join(", ");
    const secNames = brandContext.colors.secondary ? brandContext.colors.secondary.map(hexToColorName).filter(Boolean).join(", ") : "";
    
    let colorNote = `ambient color accents in ${primNames}`;
    if (secNames) colorNote += ` and ${secNames}`;
    colorNote += " subtly integrated into lighting, graphic card accents, and background";
    parts.push(colorNote);
  }

  // 5. Título Principal y Contenedor de Diseño (Tarjetas flotantes, formas y badges publicitarios)
  if (text.trim()) {
    const cleanedText = text.trim().replace(/"/g, "'").toUpperCase();
    
    let containerDesc = `displaying the exact text "${cleanedText}" in ultra-sharp, bold modern sans-serif vector typography, perfectly formed glyphs, flawless letter geometry, solid pure white font, high legibility, clean floating dark glassmorphism card container with rounded corners and a glowing electric blue underline bar`;
    
    if (textStylePreset === "modern-white") {
      containerDesc = `displaying the exact text "${cleanedText}" in ultra-sharp, bold modern sans-serif vector typography with perfectly shaped white letters, crisp straight contours and curves, flawless letter geometry and high legibility, inside a sleek floating dark glassmorphism card container with rounded corners, subtle glowing neon underline bar and a small pill badge`;
    } else if (textStylePreset === "sticker-black") {
      containerDesc = `displaying the exact text "${cleanedText}" in razor-sharp, solid bold black sans-serif typography with perfectly formed glyphs, flawless letter shapes and high contrast, inside a bright yellow or white floating sticker badge card with clean rounded corners`;
    } else if (textStylePreset === "neon-glow") {
      containerDesc = `displaying the exact text "${cleanedText}" in vibrant glowing neon tube typography with clearly defined letter contours, unbroken continuous strokes, perfectly formed glowing letters in electric cyan or hot pink hue, inside a futuristic floating dark panel with crisp neon accent lines`;
    } else if (textStylePreset === "luxury-gold") {
      containerDesc = `displaying the exact text "${cleanedText}" in polished 3D metallic gold serif typography with impeccably sculpted letterforms, clean sharp bevels and elegant light reflections, inside a premium minimalist dark card with gold border accents`;
    } else if (textStylePreset === "3d-inflated") {
      containerDesc = `displaying the exact text "${cleanedText}" in smooth 3D inflated volumetric bubble typography, perfectly formed individual letters with glossy plastic finish, sharp distinct boundaries between characters without merging`;
    }

    parts.push(`${spatialPosition}, there is a high-end graphic design element ${containerDesc}, razor-sharp font rendering, zero deformed letters, perfectly spelled text "${cleanedText}", award-winning advertising layout`);
  }

  // 6. Subtítulo (si existe)
  if (subtitle && subtitle.trim()) {
    const cleanedSub = subtitle.trim().replace(/"/g, "'");
    parts.push(`secondary subtitle text reading "${cleanedSub}" in clean, smaller, highly legible typography with perfectly formed letters positioned under the title`);
  }

  // 6.5 Viñetas (si existen)
  if (bullets && bullets.trim()) {
    const cleanBullets = bullets.trim().replace(/"/g, "'");
    parts.push(`neat feature bullet points reading "${cleanBullets}" in crisp legible micro-typography with clear glyphs`);
  }

  // 7. Ángulo comercial / Variación
  if (dailyVariation && dailyVariation !== "ninguno") {
    if (dailyVariation === "oferta") {
      parts.push("promotional commercial advertisement aesthetic");
    } else if (dailyVariation === "consejo") {
      parts.push("educational inspiring business tip aesthetic");
    } else if (dailyVariation === "novedad") {
      parts.push("exclusive announcement aesthetic");
    }
  }

  // 8. Detalles adicionales
  if (details.trim()) {
    parts.push(details.trim());
  }

  const result = parts.join(", ");
  return result || "a visually appealing, professional commercial flyer photograph with balanced composition and clean typography";
}
