export interface IdeogramPromptInput {
  subject: string;
  text?: string;
  subtitle?: string;
  /** Estilo en inglés (ver IMAGE_STYLES). */
  style?: string;
  details?: string;
  width: number;
  height: number;
}

interface IdeogramElement {
  type: "obj" | "text";
  /** [y1, x1, y2, x2] sobre 1000. */
  bbox: [number, number, number, number];
  text?: string;
  desc: string;
}

const MAX_SUMMARY_WORDS = 50;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** En los campos de prosa el esquema pide comillas simples. */
function prose(value?: string): string {
  return (value || "").trim().replace(/"/g, "'").replace(/\s+/g, " ");
}

/**
 * Prompt de Ideogram 4 con el esquema oficial, sin depender de un LLM.
 *
 * El modelo se entrenó con este JSON: el texto plano dispara su filtro y
 * devuelve "Image blocked by safety filter" en lugar de la imagen.
 */
export function ideogramPrompt(input: IdeogramPromptInput): string {
  const subject = prose(input.subject) || "A clean professional commercial scene";
  const text = (input.text || "").trim();
  const subtitle = (input.subtitle || "").trim();
  const style = prose(input.style);
  const divisor = gcd(input.width, input.height) || 1;

  const elements: IdeogramElement[] = [
    {
      type: "obj",
      bbox: text ? [400, 150, 930, 850] : [200, 150, 880, 850],
      desc: `${subject}, sharp focus, realistic materials and natural lighting.`,
    },
  ];
  if (text)
    elements.push({
      type: "text",
      bbox: [80, 80, subtitle ? 240 : 300, 920],
      text,
      desc: "Large bold clean sans-serif headline with high contrast, the only headline in the layout.",
    });
  if (subtitle)
    elements.push({
      type: "text",
      bbox: [260, 80, 340, 920],
      text: subtitle,
      desc: "Smaller clean sans-serif line directly below the headline.",
    });

  const summary = [
    `A professional advertising image of ${subject}`,
    style,
    text ? `with the headline '${prose(text)}' at the top` : "with clean empty space at the top",
  ]
    .filter(Boolean)
    .join(", ")
    .split(" ")
    .slice(0, MAX_SUMMARY_WORDS)
    .join(" ");

  return JSON.stringify({
    aspect_ratio: `${input.width / divisor}:${input.height / divisor}`,
    high_level_description: summary,
    compositional_deconstruction: {
      background:
        prose(input.details) ||
        "A clean, softly lit professional backdrop with subtle depth and generous empty space in the upper area.",
      elements,
    },
  });
}
