// A streaming request writes its requestDetails row twice under the same id:
// a placeholder queued right after the pipe starts, then the real record from
// onStreamComplete. On a fast stream the placeholder's async work (config read +
// cost lookup) finishes last, so it used to overwrite the completed row with
// prompt_tokens: 0 / completion_tokens: 0 — which zeroed the request's cost on
// /dashboard/usage while usageHistory still held the correct amount.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let adapter;

const DETAIL_ID = "stream-detail-1";
const PROVIDER = "openai";
const MODEL = "gpt-4o-mini";

function placeholderDetail(id) {
  return {
    id,
    streamPlaceholder: true,
    provider: PROVIDER,
    model: MODEL,
    timestamp: new Date().toISOString(),
    latency: { ttft: 0, total: 12 },
    tokens: { prompt_tokens: 0, completion_tokens: 0 },
    request: { model: MODEL, stream: true, messages: [] },
    providerResponse: "[Streaming - raw response not captured]",
    response: { content: "[Streaming in progress...]", thinking: null, type: "streaming" },
    status: "success",
  };
}

function completedDetail(id) {
  return {
    id,
    provider: PROVIDER,
    model: MODEL,
    timestamp: new Date().toISOString(),
    latency: { ttft: 90, total: 800 },
    tokens: { prompt_tokens: 1000, completion_tokens: 200 },
    request: { model: MODEL, stream: true, messages: [] },
    providerResponse: "hello from the model",
    response: { content: "hello from the model", thinking: null, type: "streaming" },
    status: "success",
  };
}

async function flush(detail) {
  await db.saveRequestDetail(detail);
  await new Promise((resolve) => setTimeout(resolve, 120));
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-stream-detail-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
  await db.updateSettings({ enableObservability2: true, observabilityBatchSize: 1 });
  const { getAdapter } = await import("@/lib/db/driver.js");
  adapter = await getAdapter();
});

afterAll(() => {
  adapter?.close?.();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

async function findDetail(id) {
  const { details } = await db.getRequestDetails({ pageSize: 100 });
  return details.find((detail) => detail.id === id);
}

describe("streaming request detail — placeholder must not clobber the completed row", () => {
  it("keeps tokens and cost when the placeholder is persisted after completion", async () => {
    await flush(completedDetail(DETAIL_ID));
    await flush(placeholderDetail(DETAIL_ID));

    const detail = await findDetail(DETAIL_ID);
    expect(detail).toBeDefined();
    expect(detail.tokens.prompt_tokens).toBe(1000);
    expect(detail.tokens.completion_tokens).toBe(200);
    expect(detail.response.content).toBe("hello from the model");
    expect(detail.cost).toBeGreaterThan(0);
  });

  it("still records the completed values when the placeholder lands first", async () => {
    const id = "stream-detail-2";
    await flush(placeholderDetail(id));

    const pending = await findDetail(id);
    expect(pending.tokens.completion_tokens).toBe(0);

    await flush(completedDetail(id));

    const detail = await findDetail(id);
    expect(detail.tokens.prompt_tokens).toBe(1000);
    expect(detail.cost).toBeGreaterThan(0);
  });

  it("placeholder and completion in one flush batch resolve to the completed row", async () => {
    const id = "stream-detail-3";
    await db.updateSettings({ observabilityBatchSize: 50 });
    // No await between pushes → both sit in the same buffer, completion queued first.
    const writes = [
      db.saveRequestDetail(completedDetail(id)),
      db.saveRequestDetail(placeholderDetail(id)),
    ];
    await Promise.all(writes);
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const detail = await findDetail(id);
    expect(detail.tokens.completion_tokens).toBe(200);
    expect(detail.cost).toBeGreaterThan(0);
    await db.updateSettings({ observabilityBatchSize: 1 });
  }, 15000);
});
