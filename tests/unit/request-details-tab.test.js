// Backend logic behind /dashboard/usage?tab=details.
// Covers crash-risk edge cases in getRequestDetails() used by
// /api/usage/request-details and /api/usage/providers.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildRequestDetail } from "../../open-sse/handlers/chatCore/requestDetail.js";
import {
  getCachedTokens,
  getCacheCreationTokens,
  getInputTokens,
} from "../../src/shared/utils/requestTokens.js";

const authMocks = vi.hoisted(() => ({
  getDashboardAccount: vi.fn(async () => ({ id: "test-admin", role: "admin", isActive: true })),
}));

vi.mock("@/lib/auth/dashboardSession", () => ({
  getDashboardAccount: authMocks.getDashboardAccount,
}));

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let adapter;

async function saveDetail(detail) {
  await db.saveRequestDetail(detail);
  await new Promise((r) => setTimeout(r, 120));
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-details-tab-"));
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

describe("request details — tab crash-risk cases", () => {
  it("corrupt data column → safe priced fallback, no throw", async () => {
    // Inject a row with invalid JSON directly, bypassing save path
    adapter.run(
      `INSERT INTO requestDetails(id, timestamp, provider, model, connectionId, status, data) VALUES(?, ?, ?, ?, ?, ?, ?)`,
      ["corrupt-1", new Date().toISOString(), "openai", "gpt-4", null, "ok", "{not-valid-json"]
    );

    const res = await db.getRequestDetails({ provider: "openai" });
    expect(Array.isArray(res.details)).toBe(true);
    const corrupt = res.details.find((d) => d.cost === 0 && d.costInput === null && d.costOutput === null);
    expect(corrupt).toMatchObject({ cost: 0, costInput: null, costOutput: null });
  });

  it("pagination beyond last page → empty details, valid meta", async () => {
    const res = await db.getRequestDetails({ page: 9999, pageSize: 20 });
    expect(res.details).toEqual([]);
    expect(res.pagination.page).toBe(9999);
    expect(res.pagination.hasNext).toBe(false);
    expect(res.pagination.totalItems).toBeGreaterThanOrEqual(0);
  });

  it("invalid startDate → Invalid Date ISO throws inside getRequestDetails is caught upstream", async () => {
    // new Date("bad").toISOString() throws RangeError; verify it surfaces
    // so the API route's try/catch returns 500 rather than silent corruption.
    await expect(db.getRequestDetails({ startDate: "not-a-date" })).rejects.toThrow();
  });

  it("valid date filter range → no throw", async () => {
    const res = await db.getRequestDetails({
      startDate: "2020-01-01T00:00:00",
      endDate: "2999-01-01T00:00:00",
    });
    expect(Array.isArray(res.details)).toBe(true);
  });

  it("large pageSize (providers route uses 9999) → returns all, no crash", async () => {
    await saveDetail({
      id: "big-1", provider: "anthropic", model: "claude-3",
      status: "ok", tokens: { input_tokens: 5 },
      request: { method: "POST" }, response: { content: "hi" },
    });

    const res = await db.getRequestDetails({ pageSize: 9999 });
    expect(res.details.length).toBeGreaterThanOrEqual(1);
    expect(res.pagination.pageSize).toBe(9999);
  });

  it("oversized field → stored truncated + reparseable (no circular)", async () => {
    const huge = "x".repeat(20 * 1024);
    await saveDetail({
      id: "trunc-1", provider: "openai", model: "gpt-4",
      status: "ok", tokens: {},
      request: { blob: huge }, response: { content: "ok" },
    });

    const got = await db.getRequestDetailById("trunc-1");
    expect(got).toBeDefined();
    // Truncated field is a plain object safe for JSON.stringify in the drawer
    expect(() => JSON.stringify(got)).not.toThrow();
    expect(got.request._truncated).toBe(true);
  });

  it("missing tokens/timestamp on row → getInputTokens-style access safe", async () => {
    adapter.run(
      `INSERT INTO requestDetails(id, timestamp, provider, model, connectionId, status, data) VALUES(?, ?, ?, ?, ?, ?, ?)`,
      ["sparse-1", new Date().toISOString(), "openai", null, null, null, JSON.stringify({ id: "sparse-1" })]
    );
    const got = await db.getRequestDetailById("sparse-1");
    expect(got.tokens).toBeUndefined();
    // Drawer reads tokens?.prompt_tokens — optional chaining tolerates undefined
    expect(got.tokens?.prompt_tokens || 0).toBe(0);
  });

  it("production detail builder preserves the API key used for scoped history", async () => {
    const built = buildRequestDetail({
      provider: "openai",
      model: "gpt-built",
      apiKey: "sk-built-owner",
      request: { stream: true },
      response: {},
    }, { id: "built-owned-detail" });

    expect(built.apiKey).toBe("sk-built-owner");
    await saveDetail(built);

    const result = await db.getRequestDetails({ apiKeys: ["sk-built-owner"], pageSize: 100 });
    expect(result.details.map((detail) => detail.id)).toContain("built-owned-detail");
    expect(result.details.find((detail) => detail.id === "built-owned-detail")?.apiKey).toBeUndefined();
    expect(result.details.find((detail) => detail.id === "built-owned-detail")?.apiKeyName).toBe("Unknown key");
    expect(JSON.stringify(result.details.find((detail) => detail.id === "built-owned-detail"))).not.toContain("sk-built-owner");
  });

  it("API-key filter returns only details owned by the selected account", async () => {
    await saveDetail({
      id: "owned-a", apiKey: "sk-owner-a", provider: "openai", model: "gpt-a",
      status: "ok", tokens: {}, request: {}, response: {},
    });
    await saveDetail({
      id: "owned-b", apiKey: "sk-owner-b", provider: "anthropic", model: "claude-b",
      status: "ok", tokens: {}, request: {}, response: {},
    });

    const result = await db.getRequestDetails({ apiKeys: ["sk-owner-a"], pageSize: 100 });
    expect(result.details.map((detail) => detail.id)).toContain("owned-a");
    expect(result.details.map((detail) => detail.id)).not.toContain("owned-b");
    expect(result.details.find((detail) => detail.id === "owned-a")?.apiKey).toBeUndefined();
    expect(result.details.find((detail) => detail.id === "owned-a")?.apiKeyName).toBe("Unknown key");
    expect(await db.getDistinctProviders({ apiKeys: ["sk-owner-a"] })).toContain("openai");
    expect(await db.getDistinctProviders({ apiKeys: ["sk-owner-a"] })).not.toContain("anthropic");
  });

  it("request history exposes the owning API key name without the secret", async () => {
    const owner = await db.createUser({
      username: "history.key.owner",
      email: "history.key.owner@example.com",
      password: "password-owner",
    });
    const namedKey = await db.createApiKey("Prod dashboard", "machine-history-key", owner.id);
    await saveDetail({
      id: "named-key-detail", apiKey: namedKey.key, provider: "openai", model: "gpt-named",
      status: "ok", tokens: {}, request: { stream: false }, response: {},
    });
    await saveDetail({
      id: "no-key-detail", provider: "openai", model: "gpt-local",
      status: "ok", tokens: {}, request: {}, response: {},
    });

    const result = await db.getRequestDetails({ pageSize: 100 });
    const named = result.details.find((detail) => detail.id === "named-key-detail");
    const local = result.details.find((detail) => detail.id === "no-key-detail");
    expect(named).toMatchObject({ apiKeyName: "Prod dashboard", apiKeyId: namedKey.id });
    expect(named.apiKey).toBeUndefined();
    expect(JSON.stringify(named)).not.toContain(namedKey.key);
    expect(local).toMatchObject({ apiKeyName: "No API key", apiKeyId: null });

    const byId = await db.getRequestDetailById("named-key-detail");
    expect(byId).toMatchObject({ apiKeyName: "Prod dashboard", apiKeyId: namedKey.id });
    expect(byId.apiKey).toBeUndefined();
  });

  it("activity logs expose the owning account and an inspectable detail id", async () => {
    const owner = await db.createUser({
      username: "activity.owner",
      email: "activity.owner@example.com",
      password: "password-owner",
    });
    const key = await db.createApiKey("Activity Owner Key", "machine-activity", owner.id);
    const timestamp = new Date().toISOString();
    await db.updatePricing({
      openai: {
        "gpt-activity": { input: 1, output: 2 },
      },
    });
    await db.saveRequestUsage({
      timestamp,
      provider: "openai",
      model: "gpt-activity",
      connectionId: "activity-connection",
      apiKey: key.key,
      tokens: { prompt_tokens: 17, completion_tokens: 5, cached_tokens: 8, cache_creation_input_tokens: 3 },
      status: "200 OK",
    });
    await saveDetail({
      id: "activity-log-detail",
      timestamp,
      apiKey: key.key,
      provider: "openai",
      model: "gpt-activity",
      connectionId: "activity-connection",
      status: "success",
      tokens: { prompt_tokens: 17, completion_tokens: 5, cached_tokens: 8, cache_creation_input_tokens: 3 },
      request: {},
      response: {},
    });

    const log = (await db.getRecentLogs(100)).find((item) => item.detailId === "activity-log-detail");
    expect(log).toMatchObject({
      username: "activity.owner",
      email: "activity.owner@example.com",
      apiKeyName: "Activity Owner Key",
      inputTokens: 17,
      cachedTokens: 8,
      cacheCreationTokens: 3,
      outputTokens: 5,
    });
    expect(log.cost).toBeCloseTo(0.000027, 12);
    expect((await db.getRequestDetailById("activity-log-detail")).cost).toBeCloseTo(0.000027, 12);
    expect(JSON.stringify(log)).not.toContain(key.key);
  });

  it("activity logs paginate at 30 rows by default and honor period filters", async () => {
    await saveDetail({
      id: "activity-old-detail",
      timestamp: "2020-01-01T00:00:00.000Z",
      provider: "openai",
      model: "gpt-old",
      status: "success",
      tokens: { prompt_tokens: 1, completion_tokens: 1 },
      request: {},
      response: {},
    });

    const defaultPage = await db.getRequestLogsPage({ period: "all" });
    expect(defaultPage.pagination.pageSize).toBe(30);
    expect(defaultPage.logs.length).toBeLessThanOrEqual(30);
    expect(defaultPage.pagination.totalItems).toBeGreaterThanOrEqual(2);

    const firstPage = await db.getRequestLogsPage({ period: "all", page: 1, pageSize: 1 });
    const secondPage = await db.getRequestLogsPage({ period: "all", page: 2, pageSize: 1 });
    expect(firstPage.logs).toHaveLength(1);
    expect(secondPage.logs).toHaveLength(1);
    expect(firstPage.logs[0].detailId).not.toBe(secondPage.logs[0].detailId);

    const today = await db.getRequestLogsPage({ period: "today", pageSize: 100 });
    expect(today.logs.some((item) => item.detailId === "activity-old-detail")).toBe(false);
    const allTime = await db.getRequestLogsPage({ period: "all", pageSize: 100 });
    expect(allTime.logs.some((item) => item.detailId === "activity-old-detail")).toBe(true);
  });

  it("system overview attributes usage and active requests to the API-key owner", async () => {
    const owner = await db.createUser({
      username: "system.owner",
      email: "system.owner@example.com",
      password: "password-owner",
    });
    const key = await db.createApiKey("System Owner Key", "machine-system", owner.id);
    const timestamp = new Date().toISOString();
    await db.saveRequestUsage({
      timestamp,
      provider: "openai",
      model: "gpt-system",
      apiKey: key.key,
      tokens: { prompt_tokens: 12, completion_tokens: 4 },
      status: "200 OK",
    });
    await saveDetail({
      id: "system-overview-detail",
      timestamp,
      provider: "openai",
      model: "gpt-system",
      apiKey: key.key,
      status: "success",
      tokens: { prompt_tokens: 12, completion_tokens: 4 },
      request: {},
      response: {},
    });
    db.trackPendingRequest("gpt-system", "openai", null, true, false, key.key);

    const overview = await db.getSystemUsageOverview("all");
    const user = overview.users.find((item) => item.id === owner.id);
    expect(user).toMatchObject({ username: "system.owner", requests: 1, activeRequests: 1 });
    expect(overview.recent[0]).toMatchObject({
      detailId: "system-overview-detail",
      username: "system.owner",
      apiKeyName: "System Owner Key",
    });
    expect(JSON.stringify(overview)).not.toContain(key.key);

    db.trackPendingRequest("gpt-system", "openai", null, false, false, key.key);
  });

  it("activity outcome totals use the same usage rows as the System summary", async () => {
    await saveDetail({
      id: "detail-without-usage",
      timestamp: new Date().toISOString(),
      provider: "openai",
      model: "detail-only-model",
      status: "error",
      tokens: {},
      request: {},
      response: {},
    });

    const [stats, overview] = await Promise.all([
      db.getUsageStats("all", { forceHistory: true }),
      db.getSystemUsageOverview("all"),
    ]);
    const classified = Object.values(stats.byStatus || {}).reduce((sum, value) => sum + value, 0);

    expect(classified).toBe(stats.totalRequests);
    expect(stats.totalRequests).toBe(overview.summary.requests);
  });
});

describe("backupDbLite — excludes requestDetails, keeps critical data", () => {
  it("backup file omits requestDetails rows but keeps other tables", async () => {
    const { backupDbLite } = await import("@/lib/db/backup.js");
    await saveDetail({ id: "bk-1", provider: "openai", model: "m", status: "ok", tokens: {}, request: {}, response: {} });

    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-bklite-"));
    const dest = backupDbLite(adapter, backupDir);
    expect(fs.existsSync(dest)).toBe(true);

    // Open backup and assert requestDetails is empty, settings present
    const { DatabaseSync } = await import("node:sqlite");
    const bak = new DatabaseSync(dest);
    try {
      // requestDetails is fully excluded — table must not exist in the backup
      const rdTable = bak.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='requestDetails'").get();
      expect(rdTable).toBeUndefined();
      // Critical data preserved
      const st = bak.prepare("SELECT COUNT(*) c FROM settings").get();
      expect(st.c).toBeGreaterThanOrEqual(1);
    } finally {
      bak.close();
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  });
});

describe("getDistinctProviders — providers route (no full-row parse)", () => {
  it("returns unique provider list without parsing data blobs", async () => {
    await saveDetail({ id: "dp-1", provider: "openai", model: "m", status: "ok", tokens: {}, request: {}, response: {} });
    await saveDetail({ id: "dp-2", provider: "anthropic", model: "m", status: "ok", tokens: {}, request: {}, response: {} });
    await saveDetail({ id: "dp-3", provider: "openai", model: "m", status: "ok", tokens: {}, request: {}, response: {} });

    const list = await db.getDistinctProviders();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toContain("openai");
    expect(list).toContain("anthropic");
    // No duplicates
    expect(new Set(list).size).toBe(list.length);
  });

  it("skips null providers, returns sorted", async () => {
    const list = await db.getDistinctProviders();
    expect(list.every((p) => p !== null)).toBe(true);
    const sorted = [...list].sort();
    expect(list).toEqual(sorted);
  });
});

describe("token helpers — render-time crash safety", () => {
  it("undefined/null tokens → 0, no throw", () => {
    expect(getInputTokens(undefined)).toBe(0);
    expect(getInputTokens(null)).toBe(0);
    expect(getCachedTokens(undefined)).toBe(0);
    expect(getCacheCreationTokens(null)).toBe(0);
  });

  it("empty object → 0 across all helpers", () => {
    expect(getInputTokens({})).toBe(0);
    expect(getCachedTokens({})).toBe(0);
    expect(getCacheCreationTokens({})).toBe(0);
  });

  it("prompt_tokens preferred, falls back to input_tokens", () => {
    expect(getInputTokens({ prompt_tokens: 100 })).toBe(100);
    expect(getInputTokens({ input_tokens: 50 })).toBe(50);
  });

  it("legacy Claude row (prompt < cache) → returns cache", () => {
    expect(getInputTokens({ prompt_tokens: 10, cached_tokens: 200 })).toBe(200);
  });

  it("cached via cache_read_input_tokens alias", () => {
    expect(getCachedTokens({ cache_read_input_tokens: 42 })).toBe(42);
  });

  it("cache write via nested prompt_tokens_details", () => {
    expect(getCacheCreationTokens({
      prompt_tokens_details: { cache_creation_tokens: 9 },
    })).toBe(9);
  });

  it("toLocaleString on helper result never throws", () => {
    expect(() => getInputTokens(undefined).toLocaleString()).not.toThrow();
  });
});

describe("request table column catalog", () => {
  it("hides API key and Cache write by default on both tables", () => {
    const source = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/shared/components/RequestTableColumnSettings.js"),
      "utf8",
    );
    expect(source).toMatch(/id: "apiKey", label: "API key", defaultVisible: false/);
    expect(source).toMatch(/id: "cacheWrite", label: "Cache write", defaultVisible: false/);
    expect(source).toMatch(/id: "cached", label: "Cached", defaultVisible: true/);
  });
});

describe("API route contract — validation boundary", () => {
  let GET;
  beforeAll(async () => {
    ({ GET } = await import("@/app/api/usage/request-details/route.js"));
  });

  function makeReq(query) {
    return new Request(`http://localhost/api/usage/request-details?${query}`);
  }

  it("page=0 → 400 (guard now reachable after NaN-check fix)", async () => {
    const res = await GET(makeReq("page=0"));
    expect(res.status).toBe(400);
  });

  it("page=-5 → 400", async () => {
    const res = await GET(makeReq("page=-5"));
    expect(res.status).toBe(400);
  });

  it("pageSize=101 → 400", async () => {
    const res = await GET(makeReq("pageSize=101"));
    expect(res.status).toBe(400);
  });

  it("pageSize=abc (NaN) → defaults to 20, returns 200", async () => {
    const res = await GET(makeReq("pageSize=abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination.pageSize).toBe(20);
  });

  it("invalid startDate → route catches, returns 500 (not thrown)", async () => {
    const res = await GET(makeReq("startDate=not-a-date"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("valid request → 200 with details + pagination shape", async () => {
    const res = await GET(makeReq("page=1&pageSize=20"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.pagination).toMatchObject({ page: 1, pageSize: 20 });
  });

  it("administrator default usage view excludes unattributed and foreign details", async () => {
    await saveDetail({
      id: "route-legacy-null", provider: "openai", model: "legacy-model",
      status: "ok", tokens: {}, request: { stream: false }, response: {},
    });

    const res = await GET(makeReq("page=1&pageSize=100"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.details.map((detail) => detail.id)).not.toContain("route-legacy-null");
  });

  it("administrator default usage view is scoped to owned API keys", async () => {
    const adminOwner = await db.createUser({
      username: "usage.admin.owner",
      email: "usage.admin.owner@example.com",
      password: "password-admin",
    });
    const adminKey = await db.createApiKey("Admin usage", "machine-admin-usage", adminOwner.id);
    await saveDetail({
      id: "admin-own-detail", apiKey: adminKey.key, provider: "openai", model: "admin-model",
      status: "ok", tokens: {}, request: { stream: false }, response: {},
    });
    await saveDetail({
      id: "admin-foreign-detail", apiKey: "sk-admin-foreign", provider: "openai", model: "foreign-model",
      status: "ok", tokens: {}, request: {}, response: {},
    });
    authMocks.getDashboardAccount.mockResolvedValueOnce({ id: adminOwner.id, role: "admin", isActive: true });

    const res = await GET(makeReq("page=1&pageSize=100"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.details.map((detail) => detail.id)).toContain("admin-own-detail");
    expect(body.details.map((detail) => detail.id)).not.toContain("admin-foreign-detail");
    expect(body.details.map((detail) => detail.id)).not.toContain("route-legacy-null");
    const owned = body.details.find((detail) => detail.id === "admin-own-detail");
    expect(owned).toMatchObject({ apiKeyName: "Admin usage", apiKeyId: adminKey.id });
    expect(owned.request).toEqual({ redacted: true, stream: false });
  });

  it("account route returns only details for API keys owned by the signed-in user", async () => {
    const owner = await db.createUser({
      username: "details.owner",
      email: "details.owner@example.com",
      password: "password-owner",
    });
    const ownKey = await db.createApiKey("Own details", "machine-own", owner.id);
    await saveDetail({
      id: "route-owned", apiKey: ownKey.key, provider: "openai", model: "owned-model",
      status: "ok", tokens: {}, request: {}, response: {},
    });
    await saveDetail({
      id: "route-foreign", apiKey: "sk-foreign-route", provider: "openai", model: "foreign-model",
      status: "ok", tokens: {}, request: {}, response: {},
    });
    authMocks.getDashboardAccount.mockResolvedValueOnce({ id: owner.id, role: "user", isActive: true });

    const res = await GET(makeReq("page=1&pageSize=100"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.details.map((detail) => detail.id)).toContain("route-owned");
    expect(body.details.map((detail) => detail.id)).not.toContain("route-foreign");
    expect(body.details.map((detail) => detail.id)).not.toContain("route-legacy-null");
    const owned = body.details.find((detail) => detail.id === "route-owned");
    expect(owned).toMatchObject({ apiKeyName: "Own details", apiKeyId: ownKey.id });
    expect(owned.apiKey).toBeUndefined();
    expect(JSON.stringify(owned)).not.toContain(ownKey.key);
  });

  it("administrator userId narrowing remains restricted to that user's keys", async () => {
    const target = await db.createUser({
      username: "details.target",
      email: "details.target@example.com",
      password: "password-target",
    });
    const targetKey = await db.createApiKey("Target details", "machine-target", target.id);
    await saveDetail({
      id: "route-target-user", apiKey: targetKey.key, provider: "openai", model: "target-model",
      status: "ok", tokens: {}, request: {}, response: {},
    });

    const res = await GET(makeReq(`page=1&pageSize=100&userId=${encodeURIComponent(target.id)}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.details.map((detail) => detail.id)).toContain("route-target-user");
    expect(body.details.map((detail) => detail.id)).not.toContain("route-foreign");
    expect(body.details.map((detail) => detail.id)).not.toContain("route-legacy-null");
    expect(body.details.map((detail) => detail.id)).not.toContain("admin-own-detail");
  });

  it("administrator can load one request detail while users cannot", async () => {
    const { GET: getDetail } = await import("@/app/api/usage/request-details/[id]/route.js");
    const context = { params: Promise.resolve({ id: "activity-log-detail" }) };

    const adminResponse = await getDetail(
      new Request("http://localhost/api/usage/request-details/activity-log-detail"),
      context,
    );
    expect(adminResponse.status).toBe(200);
    expect(await adminResponse.json()).toMatchObject({ id: "activity-log-detail" });

    authMocks.getDashboardAccount.mockResolvedValueOnce({ id: "member-1", role: "user", isActive: true });
    const userResponse = await getDetail(
      new Request("http://localhost/api/usage/request-details/activity-log-detail"),
      context,
    );
    expect(userResponse.status).toBe(403);
  });
});
