import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("admin account usage details", () => {
  it("exposes an admin-only user detail endpoint scoped to that user's API keys", () => {
    const route = read("src/app/api/users/[id]/details/route.js");
    expect(route).toContain('account.role !== "admin"');
    expect(route).toContain("getUserById(id)");
    expect(route).toContain("getApiKeys(id)");
    expect(route).toContain("getUsageStats(period, { apiKeyFilter:");
    expect(route).toContain("listCreditLedger(id, { limit: LEDGER_LIMIT, includeUsage: false })");
  });

  it("lets an administrator open account details from the Accounts list", () => {
    const page = read("src/app/(dashboard)/dashboard/users/UsersPageClient.js");
    // The link is prefixed for the current shell (/dashboard or /admin) rather
    // than hardcoded, so the admin panel can't navigate out of its own layout.
    expect(page).toContain('shellPath("/dashboard/users")');
    expect(page).toContain("${usersHref}/${user.id}");
    expect(page).toContain("View details");
  });

  it("renders a dedicated admin account page with identity, usage, and activity", () => {
    const page = read("src/app/(dashboard)/dashboard/users/[id]/UserDetailsClient.js");
    expect(page).toContain("Account information");
    expect(page).toContain("Encrypted · cannot be viewed");
    expect(page).toContain("Recent activity");
    expect(page).toContain("Usage by model");
    expect(page).toContain('{ value: "overview", label: "Overview" }');
    expect(page).toContain('{ value: "keys", label: "API keys" }');
    expect(page).toContain('{ value: "credit", label: "Credit" }');
    expect(page).toContain('{ value: "requests", label: "Requests" }');
    expect(page).toContain('tab === "overview"');
    expect(page).toContain('tab === "keys"');
    expect(page).toContain('tab === "credit"');
    expect(page).toContain('tab === "requests"');
  });

  it("shows cache token columns on usage, activity, and user request history", () => {
    const usage = read("src/app/(dashboard)/dashboard/usage/components/RequestDetailsTab.js");
    const logger = read("src/shared/components/RequestLogger.js");
    const columns = read("src/shared/components/RequestTableColumnSettings.js");
    expect(usage).toContain("getCachedTokens(detail.tokens)");
    expect(usage).toContain("getCacheCreationTokens(detail.tokens)");
    expect(usage).toContain('table="history"');
    expect(logger).toContain("log.cachedTokens");
    expect(logger).toContain("log.cacheCreationTokens");
    expect(logger).toContain("log.apiKeyName");
    expect(logger).toContain('table="activity"');
    expect(columns).toContain('id: "cached"');
    expect(columns).toContain('id: "cacheWrite"');
    expect(columns).toContain('id: "apiKey"');
    expect(columns).toContain('label: "API key", defaultVisible: false');
    expect(columns).toContain('label: "Cache write", defaultVisible: false');
  });
});
