// Backend behaviour behind the Usage Details drawer and the Activity system tab:
//   - provider ids are resolved to operator-facing names (custom providers are
//     stored under a generated `openai-compatible-chat-<uuid>` id)
//   - cache token counts are aggregated in SQL out of the JSON `tokens` blob
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { providerLabel } from "../../src/shared/utils/providerLabel.js";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let adapter;

const NODE_ID = "openai-compatible-chat-08a74a5e-d5cf-442d-89d3-44eaa6f5ac63";

function insertDetail(id, provider, timestamp) {
  adapter.run(
    `INSERT INTO requestDetails(id, timestamp, provider, model, connectionId, status, data) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [id, timestamp, provider, "glm-4.7", null, "success", JSON.stringify({
      id,
      timestamp,
      provider,
      model: "glm-4.7",
      status: "success",
      tokens: { prompt_tokens: 100, completion_tokens: 10, cached_tokens: 40 },
      latency: { total: 250 },
      request: { stream: true },
    })],
  );
}

function insertUsage(provider, tokens, timestamp) {
  adapter.run(
    `INSERT INTO usageHistory(timestamp, provider, model, connectionId, apiKey, endpoint, promptTokens, completionTokens, cost, status, tokens, meta)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      timestamp, provider, "glm-4.7", null, null, "/v1/chat/completions",
      tokens.prompt_tokens || 0, tokens.completion_tokens || 0, 0.01, "success",
      JSON.stringify(tokens), "{}",
    ],
  );
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-usage-labels-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();

  const { getAdapter } = await import("@/lib/db/driver.js");
  adapter = await getAdapter();

  await db.createProviderNode({ id: NODE_ID, type: "openai-compatible-chat", name: "Router2k", prefix: "2k" });
});

afterAll(() => {
  adapter?.close?.();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("providerLabel", () => {
  it("prefers the custom provider node's operator name over its generated id", () => {
    expect(providerLabel(NODE_ID, { [NODE_ID]: "Router2k" })).toBe("Router2k");
  });

  it("falls back to the registry display name, then the raw id", () => {
    expect(providerLabel("openai")).toBe("OpenAI");
    // Showing the id beats showing "Unknown": the id still identifies the row.
    expect(providerLabel("not-a-provider")).toBe("not-a-provider");
    expect(providerLabel("")).toBe("Unknown provider");
  });
});

describe("request details provider naming", () => {
  it("resolves a custom provider id to its node name", async () => {
    insertDetail("detail-custom", NODE_ID, new Date().toISOString());

    const detail = await db.getRequestDetailById("detail-custom");
    expect(detail.providerName).toBe("Router2k");
    // The raw id must survive: filters and links are keyed on it.
    expect(detail.provider).toBe(NODE_ID);

    const page = await db.getRequestDetails({ page: 1, pageSize: 10 });
    expect(page.details.find((d) => d.id === "detail-custom").providerName).toBe("Router2k");
  });

  it("labels a registry provider with its catalog name", async () => {
    insertDetail("detail-registry", "openai", new Date().toISOString());
    const detail = await db.getRequestDetailById("detail-registry");
    expect(detail.providerName).toBe("OpenAI");
  });
});

describe("system usage cache aggregation", () => {
  it("sums cache-read and cache-write tokens out of the JSON tokens blob", async () => {
    const now = new Date().toISOString();
    // OpenAI-style key…
    insertUsage("openai", { prompt_tokens: 100, completion_tokens: 10, cached_tokens: 40 }, now);
    // …and the Claude-style key, which must count the same.
    insertUsage("claude", {
      prompt_tokens: 200,
      completion_tokens: 20,
      cache_read_input_tokens: 60,
      cache_creation_input_tokens: 15,
    }, now);
    // A row with no cache fields at all must not break the SUM.
    insertUsage("openai", { prompt_tokens: 50, completion_tokens: 5 }, now);

    const overview = await db.getSystemUsageOverview("24h");
    expect(overview.summary.cachedTokens).toBe(100);
    expect(overview.summary.cacheCreationTokens).toBe(15);
    expect(overview.summary.promptTokens).toBe(350);
  });

  it("survives a non-JSON tokens column", async () => {
    adapter.run(
      `INSERT INTO usageHistory(timestamp, provider, model, promptTokens, completionTokens, cost, status, tokens, meta)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [new Date().toISOString(), "openai", "glm-4.7", 10, 1, 0, "success", "{not-json", "{}"],
    );

    const overview = await db.getSystemUsageOverview("24h");
    expect(Number.isFinite(overview.summary.cachedTokens)).toBe(true);
  });
});
