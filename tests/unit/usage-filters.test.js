import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Admin/user usage filters: request-log filters, per-account usage scoped to a
// model or date range, filter facets, and the status-bucket mapping they share.

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let adapter;
let buckets;

const HOUR = 3600_000;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

let alice;
let bob;
let aliceKey;
let bobKey;

function insertUsage({ at, model, provider = "claude", apiKey, status = "success", cost = 0.01, prompt = 100, completion = 50 }) {
  adapter.run(
    `INSERT INTO usageHistory (timestamp, provider, model, apiKey, promptTokens, completionTokens, cost, status, tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [at, provider, model, apiKey, prompt, completion, cost, status, JSON.stringify({ prompt_tokens: prompt, completion_tokens: completion })],
  );
}

let detailSeq = 0;
function insertDetail({ at, model, provider = "claude", apiKey, status = "success" }) {
  detailSeq += 1;
  const id = `rd-${detailSeq}`;
  adapter.run(
    `INSERT INTO requestDetails (id, timestamp, provider, model, apiKey, status, data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, at, provider, model, apiKey, status, JSON.stringify({ id, latency: { total: 1000 + detailSeq } })],
  );
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-usage-filters-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
  adapter = await (await import("@/lib/db/driver.js")).getAdapter();
  buckets = await import("@/lib/db/helpers/statusBuckets.js");
});

afterAll(() => {
  adapter?.close?.();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

beforeEach(async () => {
  for (const table of ["usageHistory", "usageDaily", "requestDetails", "apiKeys", "users"]) {
    adapter.exec(`DELETE FROM ${table}`);
  }
  await db.createUser({ username: "filters.admin", email: "filters.admin@example.com", password: "password-admin" });
  alice = await db.createUser({ username: "alice", email: "alice@example.com", password: "password-alice" });
  bob = await db.createUser({ username: "bob", email: "bob@example.com", password: "password-bob" });
  aliceKey = await db.createApiKey("alice-cli", "machine-a", alice.id);
  bobKey = await db.createApiKey("bob-ci", "machine-b", bob.id);

  // alice: 2 sonnet calls today, 1 gpt call 3 days ago.
  insertUsage({ at: iso(1 * HOUR), model: "claude-sonnet-4.5", apiKey: aliceKey.key, cost: 0.5 });
  insertUsage({ at: iso(2 * HOUR), model: "claude-sonnet-4.5", apiKey: aliceKey.key, cost: 0.25 });
  insertUsage({ at: iso(72 * HOUR), model: "gpt-6.1-sol", provider: "codex", apiKey: aliceKey.key, cost: 1 });
  // bob: 1 gemini call today that was rate limited, 1 gpt call today.
  insertUsage({ at: iso(3 * HOUR), model: "gemini-4-argon", provider: "gemini", apiKey: bobKey.key, status: "rate_limited", cost: 0 });
  insertUsage({ at: iso(4 * HOUR), model: "gpt-6.1-sol", provider: "codex", apiKey: bobKey.key, cost: 2 });

  insertDetail({ at: iso(1 * HOUR), model: "claude-sonnet-4.5", apiKey: aliceKey.key });
  insertDetail({ at: iso(2 * HOUR), model: "claude-sonnet-4.5", apiKey: aliceKey.key, status: "error_502" });
  insertDetail({ at: iso(3 * HOUR), model: "gemini-4-argon", provider: "gemini", apiKey: bobKey.key, status: "rate_limited" });
  insertDetail({ at: iso(4 * HOUR), model: "gpt-6.1-sol", provider: "codex", apiKey: bobKey.key });
  insertDetail({ at: iso(5 * HOUR), model: "local-model", provider: "ollama-local", apiKey: null });
});

describe("statusBuckets", () => {
  it("classifies free-form statuses into outcome buckets", () => {
    expect(buckets.normalizeUsageStatus("success")).toBe("success");
    expect(buckets.normalizeUsageStatus("ok")).toBe("success");
    expect(buckets.normalizeUsageStatus(null)).toBe("success");
    expect(buckets.normalizeUsageStatus("rate_limited")).toBe("rate_limited");
    expect(buckets.normalizeUsageStatus("error_429")).toBe("rate_limited");
    expect(buckets.normalizeUsageStatus("error_502")).toBe("error");
  });

  it("returns no SQL for an unknown bucket", () => {
    expect(buckets.statusBucketClause("rd.status", "bogus")).toBeNull();
  });

  it("rejects unparseable dates instead of throwing", () => {
    expect(buckets.toIsoOrNull("not-a-date")).toBeNull();
    expect(buckets.toIsoOrNull("")).toBeNull();
    expect(buckets.toIsoOrNull("2026-10-01T00:00:00Z")).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("getRequestLogsPage filters", () => {
  it("filters by owning account", async () => {
    const { logs, pagination } = await db.getRequestLogsPage({ period: "24h", pageSize: 30, filters: { userId: alice.id } });
    expect(pagination.totalItems).toBe(2);
    expect(logs.every((log) => log.username === "alice")).toBe(true);
  });

  it("filters keyless local traffic with the __local__ sentinel", async () => {
    const { logs } = await db.getRequestLogsPage({ period: "24h", pageSize: 30, filters: { userId: "__local__" } });
    expect(logs.map((log) => log.model)).toEqual(["local-model"]);
  });

  it("filters by model and provider", async () => {
    const byModel = await db.getRequestLogsPage({ period: "24h", pageSize: 30, filters: { model: "gpt-6.1-sol" } });
    expect(byModel.pagination.totalItems).toBe(1);
    const byProvider = await db.getRequestLogsPage({ period: "24h", pageSize: 30, filters: { provider: "gemini" } });
    expect(byProvider.logs.map((log) => log.model)).toEqual(["gemini-4-argon"]);
  });

  it("filters by outcome bucket, matching error_<code> variants", async () => {
    const failed = await db.getRequestLogsPage({ period: "24h", pageSize: 30, filters: { status: "error" } });
    expect(failed.logs.map((log) => log.status)).toEqual(["error_502"]);
    const limited = await db.getRequestLogsPage({ period: "24h", pageSize: 30, filters: { status: "rate_limited" } });
    expect(limited.pagination.totalItems).toBe(1);
    const ok = await db.getRequestLogsPage({ period: "24h", pageSize: 30, filters: { status: "success" } });
    expect(ok.pagination.totalItems).toBe(3);
  });

  it("lets an explicit date range override the period", async () => {
    const { pagination } = await db.getRequestLogsPage({
      period: "all",
      pageSize: 30,
      filters: { startDate: iso(3.5 * HOUR), endDate: iso(1.5 * HOUR) },
    });
    expect(pagination.totalItems).toBe(2);
  });
});

describe("getUsageByOwner filters", () => {
  it("reports window totals and the top model per account", async () => {
    const usage = await db.getUsageByOwner("24h");
    expect(usage[alice.id]).toMatchObject({ requestsInPeriod: 2, topModel: "claude-sonnet-4.5", modelCount: 1, requests: 3 });
    expect(usage[alice.id].costInPeriod).toBeCloseTo(0.75);
    expect(usage[alice.id].tokensInPeriod).toBe(300);
    expect(usage[bob.id]).toMatchObject({ requestsInPeriod: 2, modelCount: 2 });
  });

  it("scopes every figure to one model", async () => {
    const usage = await db.getUsageByOwner("7d", { model: "gpt-6.1-sol" });
    expect(usage[alice.id]).toMatchObject({ requestsInPeriod: 1, requests: 1, topModel: "gpt-6.1-sol" });
    expect(usage[bob.id]).toMatchObject({ requestsInPeriod: 1, requests: 1 });
    expect(usage[bob.id].costInPeriod).toBeCloseTo(2);
  });

  it("drops accounts that never used the model", async () => {
    const usage = await db.getUsageByOwner("7d", { model: "gemini-4-argon" });
    expect(usage[alice.id]).toBeUndefined();
    expect(usage[bob.id].requestsInPeriod).toBe(1);
  });

  it("uses an explicit date range instead of the period", async () => {
    const usage = await db.getUsageByOwner("24h", { startDate: iso(96 * HOUR), endDate: iso(48 * HOUR) });
    expect(usage[alice.id].requestsInPeriod).toBe(1);
    expect(usage[alice.id].topModel).toBe("gpt-6.1-sol");
    expect(usage[bob.id].requestsInPeriod).toBe(0);
  });
});

describe("getUsageFacets", () => {
  it("lists system-wide models and providers busiest first", async () => {
    const facets = await db.getUsageFacets();
    expect(facets.models.map((option) => option.value)).toEqual(["claude-sonnet-4.5", "gpt-6.1-sol", "gemini-4-argon"]);
    expect(facets.models[0].count).toBe(2);
    expect(facets.providers.map((option) => option.value)).toContain("codex");
    expect(facets.statuses.map((option) => option.value)).toEqual(["success", "error", "rate_limited"]);
  });

  it("limits options to the given keys", async () => {
    const facets = await db.getUsageFacets({ apiKeyFilter: [bobKey.key] });
    expect(facets.models.map((option) => option.value).sort()).toEqual(["gemini-4-argon", "gpt-6.1-sol"]);
  });

  it("returns nothing for an account without keys", async () => {
    const facets = await db.getUsageFacets({ apiKeyFilter: [] });
    expect(facets.models).toEqual([]);
    expect(facets.providers).toEqual([]);
  });
});
