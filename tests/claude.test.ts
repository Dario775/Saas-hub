import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { claudeEffort, queryClaude } from "../src/lib/claude";
import { CLAUDE_DEFAULT_MODEL, CLAUDE_MODELS } from "../src/lib/claude-models";
import { LLM_DEFAULTS, resolveLLMConfig } from "../src/lib/llm";

/** Ninguna prueba usa la red ni claves reales. */

type SentBody = Record<string, unknown> & { output_config?: { effort?: string }; system?: string };

const ENV = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDE_API_EFFORT", "CLAUDE_API_MODEL"];
const saved = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));
beforeEach(() => ENV.forEach((name) => delete process.env[name]));
afterEach(() =>
  ENV.forEach((name) => {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }),
);

function sse(text: string, stopReason = "end_turn"): string {
  const events = [
    { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: CLAUDE_DEFAULT_MODEL, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } },
    ...(text
      ? [
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
          { type: "content_block_stop", index: 0 },
        ]
      : []),
    { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 2 } },
    { type: "message_stop" },
  ];
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
}

function fake(reply: () => Response) {
  const sent: { url: string; body: SentBody; headers: Headers }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return reply();
  }) as typeof fetch;
  const ask = (extra: Partial<Parameters<typeof queryClaude>[0]> = {}) =>
    queryClaude({ model: CLAUDE_DEFAULT_MODEL, system: "sistema", user: "hola", apiKey: "clave-de-prueba", fetchImpl, ...extra });
  return { sent, ask };
}

const ok = (text: string, stop?: string) => () =>
  new Response(sse(text, stop), { headers: { "content-type": "text/event-stream" } });
const failure = (status: number, type: string) => () =>
  Response.json({ type: "error", error: { type, message: "detalle" } }, { status, headers: { "x-should-retry": "false" } });

test("Claude se resuelve como proveedor y su modelo se puede cambiar", () => {
  assert.deepEqual(resolveLLMConfig({ provider: "claude" }), { provider: "claude", model: "claude-opus-5-5" });
  assert.equal(resolveLLMConfig({ provider: "claude", claudeModel: "claude-haiku-5-5" }).model, "claude-haiku-5-5");
  process.env.CLAUDE_API_MODEL = "claude-sonnet-5-5";
  assert.equal(resolveLLMConfig({ provider: "claude" }).model, "claude-sonnet-5-5");
  assert.equal(LLM_DEFAULTS.claude.label, "Claude");
});

test("envía sistema y usuario, y devuelve el texto", async () => {
  const { sent, ask } = fake(ok("listo"));
  assert.equal(await ask(), "listo");
  assert.match(sent[0].url, /\/v1\/messages/);
  assert.equal(sent[0].body.model, "claude-opus-5-5");
  assert.equal(sent[0].body.system, "sistema");
  assert.deepEqual(sent[0].body.messages, [{ role: "user", content: "hola" }]);
  // Estos parámetros los rechazan los modelos actuales.
  for (const removed of ["temperature", "top_p", "top_k", "thinking"]) assert.equal(removed in sent[0].body, false);
});

test("para JSON lo pide en las instrucciones", async () => {
  const { sent, ask } = fake(ok("{}"));
  await ask({ expectJson: true });
  assert.match(String(sent[0].body.system), /únicamente con un objeto JSON válido/);
});

test("el reintento por rechazo solo va con los modelos que lo admiten", async () => {
  for (const model of CLAUDE_MODELS) {
    const { sent, ask } = fake(ok("x"));
    await ask({ model: model.id });
    assert.equal(sent[0].body.fallbacks, model.serverFallback ? "default" : undefined, model.id);
    assert.equal(sent[0].body.output_config?.effort, "medium");
  }
  const { sent, ask } = fake(ok("x"));
  await ask({ model: "modelo-escrito-a-mano" });
  assert.equal("fallbacks" in sent[0].body, false);
  assert.equal("output_config" in sent[0].body, false);
});

test("el nivel de razonamiento se ajusta y descarta valores inválidos", () => {
  assert.equal(claudeEffort("low"), "low");
  assert.equal(claudeEffort("cualquiera"), "medium");
  assert.equal(claudeEffort(undefined), "medium");
});

test("cada error se explica sin exponer la clave", async () => {
  const cases: [number, string, RegExp][] = [
    [401, "authentication_error", /rechazó la credencial/],
    [402, "billing_error", /saldo/],
    [403, "permission_error", /permiso/],
    [404, "not_found_error", /no existe/],
    [429, "rate_limit_error", /límite/],
    [400, "invalid_request_error", /rechazó la solicitud \(400\)/],
    [529, "overloaded_error", /no está disponible/],
  ];
  for (const [status, type, expected] of cases)
    await assert.rejects(fake(failure(status, type)).ask(), (error: Error) => {
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /clave-de-prueba/);
      return true;
    });
});

test("una respuesta rechazada, cortada o vacía no pasa como válida", async () => {
  await assert.rejects(fake(ok("algo", "refusal")).ask(), /políticas de uso/);
  await assert.rejects(fake(ok("algo", "max_tokens")).ask(), /cortada/);
  await assert.rejects(fake(ok("")).ask(), /vacía/);
});
