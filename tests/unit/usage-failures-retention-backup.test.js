import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Covers three previously unowned behaviours:
//  - failed requests reaching usageHistory so byStatus is not a structural 100%
//  - usageHistory retention (it had no delete path at all)
//  - exportDb/importDb round-tripping accounts, ledger and API-key ownership
const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;

async function adapter() {
  return (await import("@/lib/db/driver.js")).getAdapter();
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-usage-failure-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
});

afterAll(async () => {
  (await adapter())?.close?.();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

beforeEach(async () => {
  const a = await adapter();
  a.exec("DELETE FROM usageHistory");
  a.exec("DELETE FROM usageDaily");
  a.exec("DELETE FROM creditLedger");
  a.exec("DELETE FROM apiKeys");
  a.exec("DELETE FROM users");
});

describe("failed requests in usage stats", () => {
  it("records a failure so byStatus stops reporting a structural 100% success", async () => {
    await db.saveRequestUsage({
      provider: "openai",
      model: "gpt-x",
      tokens: { prompt_tokens: 10, completion_tokens: 5 },
    });
    await db.saveRequestFailure({ provider: "openai", model: "gpt-x", statusCode: 502, message: "bad gateway" });
    await db.saveRequestFailure({ provider: "openai", model: "gpt-x", statusCode: 429, message: "slow down" });

    const stats = await db.getUsageStats("all", { forceHistory: true });
    expect(stats.byStatus.success).toBe(1);
    expect(stats.byStatus.error).toBe(1);
    expect(stats.byStatus.rate_limited).toBe(1);
  });

  it("keeps the outcome total equal to totalRequests on both stats paths", async () => {
    await db.saveRequestUsage({
      provider: "openai",
      model: "gpt-x",
      tokens: { prompt_tokens: 10, completion_tokens: 5 },
    });
    await db.saveRequestFailure({ provider: "openai", model: "gpt-x", statusCode: 500 });

    // totalRequests is summed from usageHistory for short ranges but from the
    // usageDaily rollup for long ones — a failure must land in both.
    const fromHistory = await db.getUsageStats("all", { forceHistory: true });
    const fromDaily = await db.getUsageStats("all");

    const outcomes = (s) => Object.values(s.byStatus).reduce((sum, n) => sum + n, 0);
    expect(outcomes(fromHistory)).toBe(fromHistory.totalRequests);
    expect(fromDaily.totalRequests).toBe(fromHistory.totalRequests);
  });

  it("adds no tokens or cost, so spend readouts stay billing-only", async () => {
    await db.saveRequestFailure({ provider: "openai", model: "gpt-x", statusCode: 502 });

    const stats = await db.getUsageStats("all", { forceHistory: true });
    expect(stats.totalRequests).toBe(1);
    expect(stats.totalCost || 0).toBe(0);
    expect((stats.totalPromptTokens || 0) + (stats.totalCompletionTokens || 0)).toBe(0);
  });
});

describe("usageHistory retention", () => {
  it("drops rows past the window and keeps the rest", async () => {
    const a = await adapter();
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const fresh = new Date().toISOString();
    for (const timestamp of [old, old, fresh]) {
      a.run(
        `INSERT INTO usageHistory(timestamp, provider, model, promptTokens, completionTokens, cost, status) VALUES(?, 'openai', 'gpt-x', 1, 1, 0, 'ok')`,
        [timestamp],
      );
    }

    const removed = await db.pruneUsageHistory({ retentionDays: 30 });
    expect(removed).toBe(2);
    expect(a.get("SELECT COUNT(*) AS c FROM usageHistory").c).toBe(1);
  });

  it("treats a non-positive retention as pruning disabled", async () => {
    const a = await adapter();
    a.run(
      `INSERT INTO usageHistory(timestamp, provider, model, promptTokens, completionTokens, cost, status) VALUES(?, 'openai', 'gpt-x', 1, 1, 0, 'ok')`,
      [new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()],
    );

    expect(await db.pruneUsageHistory({ retentionDays: 0 })).toBe(0);
    expect(a.get("SELECT COUNT(*) AS c FROM usageHistory").c).toBe(1);
  });
});

describe("exportDb / importDb round-trip", () => {
  it("preserves accounts, ledger and API-key ownership", async () => {
    const admin = await db.createUser({
      username: "backup.admin",
      email: "backup.admin@example.com",
      password: "password-admin",
    });
    const member = await db.createUser({
      username: "backup.member",
      email: "backup.member@example.com",
      password: "password-member",
      initialCreditCents: 500,
    });
    const key = await db.createApiKey("Member Key", "test-machine", member.id);

    const exported = await db.exportDb();
    expect(exported.users).toHaveLength(2);
    expect(exported.apiKeys[0].ownerUserId).toBe(member.id);
    expect(exported.creditLedger.some((e) => e.type === "signup_bonus")).toBe(true);

    await db.importDb(exported);

    // An ownerless key is rejected with 403 by authorizeBillableApiKey, so the
    // owner reference surviving the restore is the whole point of this case.
    const restoredKey = await db.resolveApiKey(key.key);
    expect(restoredKey?.ownerUserId).toBe(member.id);

    const restoredMember = await db.getUserById(member.id);
    expect(restoredMember?.creditCents).toBe(500);
    expect(restoredMember?.username).toBe("backup.member");
    expect((await db.getUserById(admin.id))?.role).toBe("admin");
    expect((await db.listCreditLedger(member.id)).total).toBeGreaterThan(0);
  });

  it("leaves live accounts alone when the payload predates account export", async () => {
    const admin = await db.createUser({
      username: "legacy.admin",
      email: "legacy.admin@example.com",
      password: "password-admin",
    });

    const exported = await db.exportDb();
    delete exported.users;
    delete exported.creditLedger;
    await db.importDb(exported);

    expect((await db.getUserById(admin.id))?.username).toBe("legacy.admin");
  });
});
