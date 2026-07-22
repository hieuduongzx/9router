import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let authorizeBillableApiKey;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-account-billing-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
  ({ authorizeBillableApiKey } = await import("@/sse/services/auth.js"));
});

afterAll(async () => {
  const adapter = await (await import("@/lib/db/driver.js")).getAdapter();
  adapter?.close?.();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("account billing", () => {
  beforeEach(async () => {
    const adapter = await (await import("@/lib/db/driver.js")).getAdapter();
    adapter.exec("DELETE FROM usageHistory");
    adapter.exec("DELETE FROM usageDaily");
    adapter.exec("DELETE FROM apiKeys");
    adapter.exec("DELETE FROM users");
    // First user is always admin — bootstrap a stable admin for every case.
    await db.createUser({
      username: "bill.admin",
      email: "bill.admin@example.com",
      password: "password-admin",
    });
  });

  it("usdCostToCents rounds tiny usage up to one cent", () => {
    expect(db.usdCostToCents(0)).toBe(0);
    expect(db.usdCostToCents(-1)).toBe(0);
    expect(db.usdCostToCents(0.001)).toBe(1);
    expect(db.usdCostToCents(0.019)).toBe(2);
    expect(db.usdCostToCents(1.234)).toBe(124);
  });

  it("rejects non-admin keys with zero credit and allows admin zero balance", async () => {
    const user = await db.createUser({
      username: "bill.user",
      email: "bill.user@example.com",
      password: "password-user",
    });
    expect(user.role).toBe("user");
    const userKey = await db.createApiKey("user-key", "machine-bill", user.id);
    await db.setUserCreditBalance(user.id, 0);

    const denied = await authorizeBillableApiKey(userKey.key);
    expect(denied).toMatchObject({
      ok: false,
      status: 402,
    });
    expect(denied.message).toMatch(/insufficient account credit/i);

    const admin = await db.getPrimaryAdmin();
    expect(admin?.id).toBeTruthy();
    expect(admin.role).toBe("admin");
    await db.setUserCreditBalance(admin.id, 0);
    const adminKey = await db.createApiKey("admin-key", "machine-bill", admin.id);
    const allowed = await authorizeBillableApiKey(adminKey.key);
    expect(allowed.ok).toBe(true);
    expect(allowed.owner.id).toBe(admin.id);
  });

  it("rejects suspended owners and unowned keys", async () => {
    const user = await db.createUser({
      username: "bill.suspended",
      email: "bill.suspended@example.com",
      password: "password-user",
    });
    await db.setUserCreditBalance(user.id, 500);
    await db.updateUserAccess(user.id, { isActive: false });
    const key = await db.createApiKey("suspended-key", "machine-bill", user.id);

    const suspended = await authorizeBillableApiKey(key.key);
    expect(suspended).toMatchObject({ ok: false, status: 403 });
    expect(suspended.message).toMatch(/suspended/i);

    const orphan = await db.createApiKey("orphan-key", "machine-bill", null);
    const unowned = await authorizeBillableApiKey(orphan.key);
    expect(unowned).toMatchObject({ ok: false, status: 403 });
    expect(unowned.message).toMatch(/not linked to an account/i);
  });

  it("debits owner credit when usage with cost is saved", async () => {
    const user = await db.createUser({
      username: "bill.debit",
      email: "bill.debit@example.com",
      password: "password-user",
    });
    await db.setUserCreditBalance(user.id, 250);
    const key = await db.createApiKey("debit-key", "machine-bill", user.id);

    await db.updatePricing({
      openai: {
        "gpt-billing": { input: 1000000, output: 2000000 },
      },
    });

    // 2 input + 1 output tokens → $2 + $2 = $4.00 → 400 cents
    await db.saveRequestUsage({
      timestamp: new Date().toISOString(),
      provider: "openai",
      model: "gpt-billing",
      apiKey: key.key,
      tokens: { prompt_tokens: 2, completion_tokens: 1 },
      status: "ok",
    });

    // debit is async fire-and-forget after insert
    await new Promise((resolve) => setTimeout(resolve, 50));

    const after = await db.getUserById(user.id);
    expect(after.creditCents).toBe(0);

    // Further tiny usage should clamp at zero rather than throw.
    await db.setUserCreditBalance(user.id, 1);
    await db.saveRequestUsage({
      timestamp: new Date(Date.now() + 1000).toISOString(),
      provider: "openai",
      model: "gpt-billing",
      apiKey: key.key,
      tokens: { prompt_tokens: 2, completion_tokens: 1 },
      status: "ok",
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await db.getUserById(user.id)).creditCents).toBe(0);
  });

  it("allows non-admin users once they have credit", async () => {
    const user = await db.createUser({
      username: "bill.funded",
      email: "bill.funded@example.com",
      password: "password-user",
    });
    await db.setUserCreditBalance(user.id, 25);
    const key = await db.createApiKey("funded-key", "machine-bill", user.id);

    const auth = await authorizeBillableApiKey(key.key);
    expect(auth.ok).toBe(true);
    expect(auth.owner).toMatchObject({ id: user.id, creditCents: 25, role: "user" });
  });
});
