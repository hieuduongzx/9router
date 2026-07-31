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
  });

  it("lets an administrator open account details from the Accounts list", () => {
    const page = read("src/app/(dashboard)/dashboard/users/UsersPageClient.js");
    expect(page).toContain("/dashboard/users/${user.id}");
    expect(page).toContain("View details");
  });

  it("renders a dedicated admin account page with identity, usage, and activity", () => {
    const page = read("src/app/(dashboard)/dashboard/users/[id]/UserDetailsClient.js");
    expect(page).toContain("Account information");
    expect(page).toContain("Encrypted · cannot be viewed");
    expect(page).toContain("Recent activity");
    expect(page).toContain("Usage by model");
  });
});
