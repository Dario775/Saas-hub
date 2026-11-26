import test from "node:test";
import assert from "node:assert/strict";
import { LLM_DEFAULTS, queryLLM, resolveLLMConfig } from "../src/lib/llm";

/**
 * Pruebas de DeepSeek.
 *
 * Las pruebas que hablan con la API real solo se ejecutan si DEEPSEEK_API_KEY
 * está definida en el entorno, para que `npm test` siga funcionando sin red.
 *
 *   PowerShell:  $env:DEEPSEEK_API_KEY="sk-..."; npm test
 *   Bash:        DEEPSEEK_API_KEY=sk-... npm test
 */

const PING_SYSTEM =
  "Eres un verificador de conexión. Responde solo con la palabra listo.";
const PING_USER = "Responde solo con la palabra listo.";

test("DeepSeek se resuelve como proveedor con su endpoint oficial", () => {
  const { provider, model } = resolveLLMConfig({ provider: "deepseek" });
  assert.equal(provider, "deepseek");
  assert.equal(model, "deepseek-flash");
  assert.equal(
    LLM_DEFAULTS.deepseek.url,
    "https://api.deepseek.com/chat/completions",
  );
});

test("el modelo de DeepSeek se puede sobreescribir", () => {
  const { model } = resolveLLMConfig({
    provider: "deepseek",
    deepseekModel: "deepseek-v4-pro",
  });
  assert.equal(model, "deepseek-v4-pro");
});

test("los proveedores existentes siguen resolviéndose igual", () => {
  assert.equal(resolveLLMConfig({ provider: "openrouter" }).provider, "openrouter");
  assert.equal(resolveLLMConfig({ provider: "openai" }).model, "gpt-4o-mini");
  assert.equal(resolveLLMConfig({ provider: "gemini" }).model, "gemini-2.5-flash");
  assert.equal(resolveLLMConfig({ provider: "ollama" }).model, "llama3");
});

test("sin DEEPSEEK_API_KEY el error explica que falta la clave", async () => {
  const previous = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    await assert.rejects(
      () =>
        queryLLM(
          PING_SYSTEM,
          PING_USER,
          { provider: "deepseek", deepseekApiKey: "" },
          false,
        ),
      /DEEPSEEK_API_KEY/,
    );
  } finally {
    if (previous !== undefined) process.env.DEEPSEEK_API_KEY = previous;
  }
});

test(
  "conexión real con DeepSeek: modelo, latencia y respuesta",
  {
    skip: process.env.DEEPSEEK_API_KEY
      ? false
      : "DEEPSEEK_API_KEY no está definida",
  },
  async () => {
    const started = Date.now();
    const text = await queryLLM(
      PING_SYSTEM,
      PING_USER,
      { provider: "deepseek" },
      false,
    );
    const latencyMs = Date.now() - started;
    const { provider, model } = resolveLLMConfig({ provider: "deepseek" });
    console.log(
      `[deepseek] proveedor=${provider} modelo=${model} latencia=${latencyMs}ms respuesta=${JSON.stringify(
        text.trim().slice(0, 80),
      )}`,
    );
    assert.ok(text.trim().length > 0, "DeepSeek devolvió una respuesta vacía");
    assert.ok(latencyMs < 60_000, `latencia inesperada: ${latencyMs}ms`);
  },
);

test(
  "una credencial inválida devuelve un error comprensible",
  {
    skip:
      process.env.DEEPSEEK_LIVE_TESTS === "1"
        ? false
        : "definir DEEPSEEK_LIVE_TESTS=1 para probar credenciales inválidas",
  },
  async () => {
    await assert.rejects(
      () =>
        queryLLM(
          PING_SYSTEM,
          PING_USER,
          { provider: "deepseek", deepseekApiKey: "sk-clave-invalida-de-prueba" },
          false,
        ),
      /DeepSeek/,
    );
  },
);
