import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { ScheduledPost } from "../src/lib/schedule-types";

test("concurrent workers publish each record once and preserve concurrent calendar edits", async () => {
  const previousDirectory = process.cwd();
  const directory = mkdtempSync(path.join(os.tmpdir(), "hub-scheduler-"));
  const originalFetch = globalThis.fetch;
  const previousToken = process.env.FACEBOOK_TOKEN_OBSIDIANA;
  process.chdir(directory);
  process.env.FACEBOOK_TOKEN_OBSIDIANA = "test-only-token";
  let calls = 0;
  try {
    const { mutateSchedule, runPendingScheduledPosts, readDB } =
      await import("../src/lib/scheduler");
    const post: ScheduledPost = {
      id: "one",
      pageId: "obsidiana",
      message: "test",
      imagePath: null,
      scheduledAt: "2020-01-01T00:00:00Z",
      status: "pending",
      createdAt: "2020-01-01T00:00:00Z",
      publishedAt: null,
      postId: null,
      error: null,
    };
    await mutateSchedule((posts) => posts.push(post));
    globalThis.fetch = async () => {
      calls++;
      await mutateSchedule((posts) =>
        posts.push({
          ...post,
          id: "future",
          scheduledAt: "2099-01-01T00:00:00Z",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      return Response.json({ id: "mock-facebook-id" });
    };
    await Promise.all([runPendingScheduledPosts(), runPendingScheduledPosts()]);
    assert.equal(calls, 1);
    assert.equal(readDB().length, 2);
    assert.equal(
      readDB().find((post) => post.id === "one")?.status,
      "published",
    );
    assert.equal(
      readDB().find((post) => post.id === "future")?.status,
      "pending",
    );
    // An ambiguous response is surfaced for manual review, never retried automatically.
    await mutateSchedule((posts) =>
      posts.push({ ...post, id: "uncertain", status: "pending" }),
    );
    globalThis.fetch = async () => {
      calls++;
      throw new Error("Connection interrupted");
    };
    await runPendingScheduledPosts();
    await runPendingScheduledPosts();
    assert.equal(calls, 2);
    assert.match(
      readDB().find((post) => post.id === "uncertain")?.error || "",
      /Revisá Facebook/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(previousDirectory);
    if (previousToken === undefined) delete process.env.FACEBOOK_TOKEN_OBSIDIANA;
    else process.env.FACEBOOK_TOKEN_OBSIDIANA = previousToken;
    try {
      rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
    } catch {
      // Ignorar bloqueo transitorio de temp en Windows
    }
  }
});
