import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardAccount: vi.fn(),
  getProviderConnectionById: vi.fn(),
}));

vi.mock("open-sse/index.js", () => ({}));
vi.mock("@/lib/localDb", () => ({
  getProviderConnectionById: mocks.getProviderConnectionById,
  updateProviderConnection: vi.fn(),
}));
vi.mock("open-sse/services/usage.js", () => ({ getUsageForProvider: vi.fn() }));
vi.mock("open-sse/executors/index.js", () => ({ getExecutor: vi.fn() }));
vi.mock("@/lib/network/connectionProxy", () => ({ resolveConnectionProxyConfig: vi.fn() }));
vi.mock("@/shared/constants/providers", () => ({ USAGE_APIKEY_PROVIDERS: [] }));
vi.mock("@/lib/auth/dashboardSession", () => ({
  getDashboardAccount: mocks.getDashboardAccount,
}));

const { GET } = await import("../../src/app/api/usage/[connectionId]/route.js");

describe("GET /api/usage/:connectionId authorization", () => {
  it.each([null, { id: "user-1", role: "user" }])(
    "rejects non-administrator access before loading the connection",
    async (account) => {
      mocks.getDashboardAccount.mockResolvedValue(account);

      const response = await GET(new Request("http://localhost/api/usage/connection-1"), {
        params: Promise.resolve({ connectionId: "connection-1" }),
      });

      expect(response.status).toBe(403);
      expect(mocks.getProviderConnectionById).not.toHaveBeenCalled();
    }
  );

  it("preserves administrator access to connection usage", async () => {
    mocks.getDashboardAccount.mockResolvedValue({ id: "admin-1", role: "admin" });
    mocks.getProviderConnectionById.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/usage/missing"), {
      params: Promise.resolve({ connectionId: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.getProviderConnectionById).toHaveBeenCalledWith("missing");
  });
});
