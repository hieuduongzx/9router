import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * getModelRanking against a REAL SQLite adapter (temp DATA_DIR).
 *
 * The fake-adapter suite in model-ranking.test.js proves aggregation logic;
 * this one proves the SQL itself — column names, the dual-source split, and
 * the property the public leaderboard depends on: models whose usageHistory
 * rows were pruned by retention still rank via their forever-kept usageDaily
 * rollups.
 */

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-model-ranking-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
});

afterAll(async () => {
  (await import("@/lib/db/driver.js")).getAdapter?.();
  const { getAdapter } = await import("@/lib/db/driver.js");
  (await getAdapter())?.close?.();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("getModelRanking on real SQLite", () => {
  it("ranks seeded traffic and survives a retention prune via daily rollups", async () => {
    const now = Date.now();

    // Fresh traffic: two models, gpt-a leads on requests. Explicit spaced
    // timestamps — saveRequestUsage dedupes identical rows sharing a
    // millisecond, and these back-to-back awaits can land in the same one.
    for (let i = 0; i < 3; i++) {
      await db.saveRequestUsage({
        provider: "openai",
        model: "gpt-a",
        timestamp: new Date(now - (i + 1) * 60_000).toISOString(),
        endpoint: "/v1/chat/completions",
        tokens: { prompt_tokens: 100, completion_tokens: 20 },
      });
    }
    await db.saveRequestUsage({
      provider: "anthropic",
      model: "claude-b",
      timestamp: new Date(now - 60_000).toISOString(),
      endpoint: "/v1/messages",
      tokens: { prompt_tokens: 500, completion_tokens: 900 },
    });
    // Stale traffic from ~40 days ago (outside every short window).
    await db.saveRequestUsage({
      provider: "openai",
      model: "gpt-old",
      timestamp: new Date(now - 40 * 86_400_000).toISOString(),
      endpoint: "/v1/chat/completions",
      tokens: { prompt_tokens: 1000, completion_tokens: 0 },
    });

    const ranking = await db.getModelRanking("all", {});
    expect(ranking.models.map((m) => m.model)).toEqual(["gpt-a", "claude-b", "gpt-old"]);
    expect(ranking.models[0].rank).toBe(1);
    expect(ranking.totalRequests).toBe(5);

    // Sub-day windows read only live history.
    const lastHour = await db.getModelRanking("1h", {});
    expect(lastHour.models.map((m) => m.model).sort()).toEqual(["claude-b", "gpt-a"]);
    expect(lastHour.models.find((m) => m.model === "gpt-a").requests).toBe(3);
    expect(lastHour.totalTokens).toBe(3 * 120 + 1400); // gpt-a ×3 + claude-b

    // Retention prunes the stale history row…
    const removed = await db.pruneUsageHistory({ retentionDays: 7 });
    expect(removed).toBeGreaterThanOrEqual(1);

    // …but the leaderboard keeps it through its usageDaily rollup.
    const afterPrune = await db.getModelRanking("all", {});
    const gptOld = afterPrune.models.find((m) => m.model === "gpt-old");
    expect(gptOld).toBeDefined();
    expect(gptOld.requests).toBe(1);
    expect(gptOld.promptTokens).toBe(1000);
    expect(afterPrune.totalRequests).toBe(5);
  });
});
