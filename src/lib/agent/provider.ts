import { CLAUDE_MODELS } from "../claude-models";
import { LLM_DEFAULTS, queryLLM, type LLMSettings } from "../llm";

/** Quién piensa por el agente: Claude (recomendado) o un modelo local con Ollama. */
export type AgentProvider = "claude" | "ollama";

export interface AgentModel {
  provider: AgentProvider;
  /** Modelo que interpreta los pedidos. */
  model: string;
  /** Modelo que idea los flyers (formato del módulo de flyers). */
  flyerModel: string;
}

const DEFAULT_CLAUDE = "claude-sonnet-5-5";
const ASK_TIMEOUT_MS = 90_000;

export function agentModel(env: NodeJS.ProcessEnv = process.env): AgentModel {
  const provider: AgentProvider = env.AGENT_PROVIDER === "ollama" ? "ollama" : "claude";
  if (provider === "claude") {
    const model = CLAUDE_MODELS.some((item) => item.id === env.AGENT_MODEL) ? env.AGENT_MODEL! : DEFAULT_CLAUDE;
    return { provider, model, flyerModel: env.AGENT_FLYER_MODEL || model };
  }
  const model = env.AGENT_MODEL || env.LOCAL_LLM_MODEL || LLM_DEFAULTS.ollama.model;
  return { provider, model, flyerModel: env.AGENT_FLYER_MODEL || `ollama:${model}` };
}

/** Pregunta al modelo del agente y devuelve su respuesta en JSON (texto). */
export type AgentAsk = (system: string, user: string) => Promise<string>;

export function createAgentAsk(choice: AgentModel = agentModel()): AgentAsk {
  const settings: LLMSettings =
    choice.provider === "claude"
      ? { provider: "claude", claudeModel: choice.model }
      : { provider: "ollama", ollamaModel: choice.model };
  return (system, user) => queryLLM(system, user, settings, true, { timeoutMs: ASK_TIMEOUT_MS });
}

export function describeModel(choice: AgentModel): string {
  return choice.provider === "claude" ? `Claude (${choice.model})` : `local con Ollama (${choice.model})`;
}
