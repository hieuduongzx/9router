// Verify schema migration chain runs correctly across versions.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let tempDir;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-mig-"));
  process.env.DATA_DIR = tempDir;
  // Reset global singleton so each test gets fresh adapter pointed at tempDir
  delete global._dbAdapter;
  vi.resetModules();
});

afterEach(() => {
  // Close adapter to release file handles before rm
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("Schema migrations", () => {
  it("fresh DB → applies migrations & stamps schemaVersion", async () => {
    const { getAdapter } = await import("@/lib/db/driver.js");
    const { latestVersion } = await import("@/lib/db/migrations/index.js");
    const db = await getAdapter();
    const row = db.get(`SELECT value FROM _meta WHERE key='schemaVersion'`);
    expect(parseInt(row.value, 10)).toBe(latestVersion());

    const tables = db.all(`SELECT name FROM sqlite_master WHERE type='table'`).map(t => t.name);
    expect(tables).toEqual(expect.arrayContaining([
      "_meta", "settings", "providerConnections", "providerNodes",
      "proxyPools", "apiKeys", "combos", "kv", "usageHistory", "usageDaily", "requestDetails",
      "externalIdentities",
    ]));
    const userColumns = db.all("PRAGMA table_info(users)").map((column) => column.name);
    expect(userColumns).toContain("creditCents");
  });

  it("provisions and persistently binds external identities without bootstrapping an admin", async () => {
    const {
      createUser,
      getUserByExternalIdentity,
      resolveOrProvisionExternalIdentity,
    } = await import("@/lib/db/index.js");

    const [first, concurrent] = await Promise.all([
      resolveOrProvisionExternalIdentity("saml:https://idp.example", "stable-subject"),
      resolveOrProvisionExternalIdentity("saml:https://idp.example", "stable-subject"),
    ]);

    expect(first.id).toBe(concurrent.id);
    expect(first.role).toBe("user");
    expect(first.email).toMatch(/^saml-[0-9a-f]+@identity\.local$/);
    expect((await getUserByExternalIdentity("saml:https://idp.example", "stable-subject")).id).toBe(first.id);

    const assertedEmailAccount = await createUser({
      username: "existing.admin",
      email: "asserted@example.com",
      password: "existing-password",
      role: "admin",
    });
    expect(assertedEmailAccount.role).toBe("admin");
    expect(assertedEmailAccount.id).not.toBe(first.id);

    const otherProvider = await resolveOrProvisionExternalIdentity(
      "saml:https://other-idp.example",
      "stable-subject",
    );
    expect(otherProvider.id).not.toBe(first.id);
  });

  it("existing DB at older schemaVersion → re-applies pending migrations on restart", async () => {
    // 1st boot
    const { getAdapter } = await import("@/lib/db/driver.js");
    const db = await getAdapter();
    db.run(`INSERT INTO settings(id, data) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`, ['{"foo":"bar"}']);
    db.run(`UPDATE _meta SET value = '0' WHERE key = 'schemaVersion'`);
    db.close?.();

    // 2nd boot: full reset to simulate process restart
    delete global._dbAdapter;
    vi.resetModules();
    const { getAdapter: getAdapter2 } = await import("@/lib/db/driver.js");
    const { latestVersion } = await import("@/lib/db/migrations/index.js");
    const db2 = await getAdapter2();
    const row = db2.get(`SELECT value FROM _meta WHERE key='schemaVersion'`);
    expect(parseInt(row.value, 10)).toBe(latestVersion());

    const settings = db2.get(`SELECT data FROM settings WHERE id=1`);
    expect(JSON.parse(settings.data)).toEqual({ foo: "bar" });
  });

  it("schema v1 without users table → completes account migration on restart", async () => {
    const { getAdapter } = await import("@/lib/db/driver.js");
    const db = await getAdapter();
    db.exec("DROP TABLE users");
    db.run("UPDATE _meta SET value = '1' WHERE key = 'schemaVersion'");
    db.close?.();

    delete global._dbAdapter;
    vi.resetModules();
    const { getAdapter: getAdapter2 } = await import("@/lib/db/driver.js");
    const db2 = await getAdapter2();

    expect(db2.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")).toBeTruthy();
    expect(db2.all("PRAGMA table_info(apiKeys)").map((column) => column.name)).toContain("ownerUserId");
    expect(db2.get("SELECT value FROM _meta WHERE key = 'schemaVersion'")?.value).toBe(String((await import("@/lib/db/migrations/index.js")).latestVersion()));
  });

  it("fresh DB + legacy db.json → imports data automatically", async () => {
    // Simulate user upgrading: place legacy JSON in DATA_DIR before first boot
    const legacy = {
      settings: { foo: "legacy-value" },
      apiKeys: [{ id: "k1", key: "abc", name: "test", createdAt: new Date().toISOString() }],
      modelAliases: { "gpt-4": "gpt-4-turbo" },
    };
    fs.writeFileSync(path.join(tempDir, "db.json"), JSON.stringify(legacy));

    const { getAdapter } = await import("@/lib/db/driver.js");
    const db = await getAdapter();

    const settings = db.get(`SELECT data FROM settings WHERE id=1`);
    expect(JSON.parse(settings.data)).toEqual({ foo: "legacy-value" });

    const keys = db.all(`SELECT * FROM apiKeys`);
    expect(keys).toHaveLength(1);
    expect(keys[0].key).toBe("abc");

    const aliases = db.all(`SELECT * FROM kv WHERE scope='modelAliases'`);
    expect(aliases).toHaveLength(1);
  });

  it("stores credit as integer cents and rejects overdrafts", async () => {
    const {
      createUser,
      adjustUserCredit,
      getUserById,
      setUserCreditBalance,
    } = await import("@/lib/db/index.js");
    const user = await createUser({
      username: "credit.user",
      email: "credit.user@example.com",
      password: "credit-password",
    });
    expect(user.creditCents).toBe(0);

    const credited = await adjustUserCredit(user.id, 1250);
    expect(credited.creditCents).toBe(1250);
    const debited = await adjustUserCredit(user.id, -500);
    expect(debited.creditCents).toBe(750);

    await expect(adjustUserCredit(user.id, -751)).rejects.toThrow("cannot be negative");
    expect((await getUserById(user.id)).creditCents).toBe(750);

    expect((await setUserCreditBalance(user.id, 4321)).creditCents).toBe(4321);
    expect((await setUserCreditBalance(user.id, 0)).creditCents).toBe(0);
    await expect(setUserCreditBalance(user.id, -1)).rejects.toThrow("non-negative");
    expect((await getUserById(user.id)).creditCents).toBe(0);
  });

  it("updates a profile atomically and preserves account state", async () => {
    const {
      createUser,
      getUserByLogin,
      setUserCreditBalance,
      updateUserProfile,
    } = await import("@/lib/db/index.js");
    const user = await createUser({
      username: "profile.user",
      email: "profile.user@example.com",
      password: "profile-password",
    });
    await createUser({
      username: "existing.user",
      email: "existing.user@example.com",
      password: "existing-password",
    });
    await setUserCreditBalance(user.id, 4321);

    const updated = await updateUserProfile(user.id, {
      username: "Profile.Updated",
      email: "PROFILE.UPDATED@example.com",
    });

    expect(updated).toMatchObject({
      id: user.id,
      username: "profile.updated",
      email: "profile.updated@example.com",
      creditCents: 4321,
      isActive: true,
    });
    expect(await getUserByLogin("profile.user")).toBeNull();
    expect((await getUserByLogin("PROFILE.UPDATED")).id).toBe(user.id);
    await expect(updateUserProfile(user.id, {
      username: "existing.user",
      email: "profile.updated@example.com",
    })).rejects.toMatchObject({ code: "USERNAME_EXISTS" });
    expect((await getUserByLogin("profile.updated")).email).toBe("profile.updated@example.com");
  });

  it("auto-sync re-creates missing index when DB lacks it", async () => {
    const { getAdapter } = await import("@/lib/db/driver.js");
    const db = await getAdapter();
    db.exec(`DROP INDEX IF EXISTS idx_pn_type`);
    expect(db.all(`PRAGMA index_list(providerNodes)`).map(i => i.name)).not.toContain("idx_pn_type");
    db.close?.();

    delete global._dbAdapter;
    vi.resetModules();
    const { getAdapter: getAdapter2 } = await import("@/lib/db/driver.js");
    const db2 = await getAdapter2();
    const idx = db2.all(`PRAGMA index_list(providerNodes)`).map(i => i.name);
    expect(idx).toContain("idx_pn_type");
  });
});
