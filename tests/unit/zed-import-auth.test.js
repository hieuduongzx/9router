import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardAccount: vi.fn(),
  createProviderConnection: vi.fn(),
  fetchZedAuthenticatedUser: vi.fn(),
  resolveZedOrganizationId: vi.fn(),
}));

vi.mock("@/models", () => ({ createProviderConnection: mocks.createProviderConnection }));
vi.mock("@/lib/auth/dashboardSession", () => ({
  getDashboardAccount: mocks.getDashboardAccount,
}));
vi.mock("open-sse/shared/zedAuth.js", () => ({
  fetchZedAuthenticatedUser: mocks.fetchZedAuthenticatedUser,
  resolveZedOrganizationId: mocks.resolveZedOrganizationId,
}));

const { POST } = await import("../../src/app/api/oauth/zed/import/route.js");

describe("POST /api/oauth/zed/import authorization", () => {
  it.each([null, { id: "user-1", role: "user" }])(
    "rejects unauthenticated and non-admin callers with 403",
    async (account) => {
      mocks.getDashboardAccount.mockResolvedValue(account);
      const request = new Request("http://localhost/api/oauth/zed/import", {
        method: "POST",
        body: "not-json",
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      expect(mocks.fetchZedAuthenticatedUser).not.toHaveBeenCalled();
      expect(mocks.createProviderConnection).not.toHaveBeenCalled();
    },
  );

  it("allows an administrator to continue to request validation", async () => {
    mocks.getDashboardAccount.mockResolvedValue({ id: "admin-1", role: "admin" });
    const response = await POST(
      new Request("http://localhost/api/oauth/zed/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Access token is required" });
    expect(mocks.fetchZedAuthenticatedUser).not.toHaveBeenCalled();
  });
});
