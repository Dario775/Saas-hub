import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

test("same-origin saves accept the original loopback host while rejecting foreign origins", () => {
  const previousUrl = process.env.PUBLIC_APP_URL;
  const previousPassword = process.env.HUB_PASSWORD;
  delete process.env.PUBLIC_APP_URL;
  delete process.env.HUB_PASSWORD;
  function request(host: string, origin: string, site = "same-origin") {
    // Reproduce NextURL's internal localhost URL with the real HTTP Host header.
    return new NextRequest("http://localhost:3010/api/brands", {
      method: "POST",
      headers: { host, origin, "sec-fetch-site": site },
    });
  }
  try {
    assert.equal(proxy(request("127.0.0.1:3010", "http://127.0.0.1:3010")).status, 200);
    assert.equal(proxy(request("localhost:3010", "http://localhost:3010")).status, 200);
    assert.equal(proxy(request("127.0.0.1:3010", "https://foreign.example")).status, 403);
    assert.equal(proxy(request("127.0.0.1:3010", "http://127.0.0.1:3011")).status, 403);
    assert.equal(proxy(request("127.0.0.1:3010", "http://127.0.0.1:3010", "cross-site")).status, 403);
    process.env.PUBLIC_APP_URL = "https://hub.example";
    assert.equal(proxy(request("localhost:3010", "https://hub.example")).status, 200);
    assert.equal(proxy(request("localhost:3010", "http://localhost:3010")).status, 403);
  } finally {
    if (previousUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previousUrl;
    if (previousPassword === undefined) delete process.env.HUB_PASSWORD;
    else process.env.HUB_PASSWORD = previousPassword;
  }
});
