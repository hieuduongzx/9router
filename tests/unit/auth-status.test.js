import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  json: vi.fn((body, init) => ({
    status: init?.status || 200,
    body,
  })),
  cookies: vi.fn(),
  getSettings: vi.fn(),
  isOidcConfigured: vi.fn(),
  getDashboardAuthSession: vi.fn(),
  getPrimaryAdmin: vi.fn(),
  getUserById: vi.fn(),
  publicUser: vi.fn((u) => ({ id: u.id, username: u.username })),
  renewDashboardAuthCookie: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: mocks.json },
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: mocks.getSettings,
}));

vi.mock("@/lib/auth/oidc", () => ({
  isOidcConfigured: mocks.isOidcConfigured,
}));

vi.mock("@/lib/db/repos/usersRepo", () => ({
  getPrimaryAdmin: mocks.getPrimaryAdmin,
  getUserById: mocks.getUserById,
  publicUser: mocks.publicUser,
}));

vi.mock("@/lib/auth/dashboardSession", () => ({
  getDashboardAuthSession: mocks.getDashboardAuthSession,
  renewDashboardAuthCookie: mocks.renewDashboardAuthCookie,
}));

vi.mock("@/shared/constants/dashboardView", () => ({
  DASHBOARD_VIEW_COOKIE: "router2k.dashboard.view",
  resolveDashboardViewMode: () => "user",
}));

const { GET } = await import("../../src/app/api/auth/status/route.js");

describe("GET /api/auth/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ requireLogin: true, authMode: "password" });
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => ({ value: "session-token" })) });
    mocks.isOidcConfigured.mockReturnValue(false);
    mocks.getPrimaryAdmin.mockResolvedValue({});
    mocks.renewDashboardAuthCookie.mockResolvedValue();
  });

  it("reports an authenticated session when the auth cookie resolves to an active account", async () => {
    mocks.getDashboardAuthSession.mockResolvedValue({ authenticated: true, userId: "u1" });
    mocks.getUserById.mockResolvedValue({ id: "u1", username: "admin", role: "admin", isActive: true });

    const response = await GET();

    expect(response.body.authenticated).toBe(true);
    expect(mocks.getDashboardAuthSession).toHaveBeenCalledWith("session-token");
  });

  it("reports unauthenticated when the auth cookie is invalid", async () => {
    mocks.getDashboardAuthSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.body.authenticated).toBe(false);
  });

  it("fails closed when status dependencies throw", async () => {
    mocks.getSettings.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();

    expect(response.body.authenticated).toBe(false);
    expect(response.body.requireLogin).toBe(true);
  });
});
