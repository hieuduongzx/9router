import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  getDashboardAccount: vi.fn(),
  shouldUseSecureCookie: vi.fn(),
  json: vi.fn((body, init = {}) => ({
    body,
    status: init.status || 200,
    headers: init.headers,
  })),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: mocks.json },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: mocks.cookieSet })),
}));

vi.mock("@/lib/auth/dashboardSession", () => ({
  getDashboardAccount: mocks.getDashboardAccount,
  shouldUseSecureCookie: mocks.shouldUseSecureCookie,
}));

const {
  DASHBOARD_VIEW_ADMIN,
  DASHBOARD_VIEW_COOKIE,
  DASHBOARD_VIEW_USER,
  resolveDashboardViewMode,
} = await import("../../src/shared/constants/dashboardView.js");
const { POST } = await import("../../src/app/api/auth/view-mode/route.js");

function request(mode) {
  return {
    json: vi.fn(async () => ({ mode })),
  };
}

describe("dashboard view mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDashboardAccount.mockResolvedValue({ id: "admin-1", role: "admin", isActive: true });
    mocks.shouldUseSecureCookie.mockReturnValue(true);
  });

  it("clamps every non-admin and invalid admin preference to a safe effective view", () => {
    expect(resolveDashboardViewMode("user", DASHBOARD_VIEW_ADMIN)).toBe(DASHBOARD_VIEW_USER);
    expect(resolveDashboardViewMode(null, DASHBOARD_VIEW_ADMIN)).toBe(DASHBOARD_VIEW_USER);
    expect(resolveDashboardViewMode("admin", "invalid")).toBe(DASHBOARD_VIEW_ADMIN);
    expect(resolveDashboardViewMode("admin", DASHBOARD_VIEW_USER)).toBe(DASHBOARD_VIEW_USER);
  });

  it("persists an administrator preference without changing the account role", async () => {
    const response = await POST(request(DASHBOARD_VIEW_USER));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ viewMode: DASHBOARD_VIEW_USER, isAdminView: false });
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      DASHBOARD_VIEW_COOKIE,
      DASHBOARD_VIEW_USER,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      },
    );
    expect(mocks.getDashboardAccount).toHaveBeenCalledOnce();
  });

  it("rejects non-admin and invalid mutations without writing a cookie", async () => {
    mocks.getDashboardAccount.mockResolvedValueOnce({ id: "user-1", role: "user", isActive: true });
    const forbidden = await POST(request(DASHBOARD_VIEW_ADMIN));
    expect(forbidden.status).toBe(403);

    mocks.getDashboardAccount.mockResolvedValueOnce({ id: "admin-1", role: "admin", isActive: true });
    const invalid = await POST(request("invalid"));
    expect(invalid.status).toBe(400);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
