import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("jose", () => ({
  SignJWT: class {},
  jwtVerify: mocks.jwtVerify,
}));

vi.mock("@/lib/dataDir", () => ({
  DATA_DIR: ".",
}));

vi.mock("@/lib/db/repos/usersRepo", () => ({
  getUserById: mocks.getUserById,
  verifyUserPassword: vi.fn(),
}));

process.env.JWT_SECRET = "dashboard-session-account-state-test-secret";

const { getDashboardAuthSession, verifyDashboardAuthToken } = await import(
  "../../src/lib/auth/dashboardSession.js"
);

describe("dashboard session account state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.jwtVerify.mockResolvedValue({
      payload: { authenticated: true, userId: "user-1", oidc: true },
    });
  });

  it("accepts a session only while its account is active", async () => {
    mocks.getUserById.mockResolvedValue({ id: "user-1", isActive: true });

    await expect(verifyDashboardAuthToken("token")).resolves.toBe(true);
    await expect(getDashboardAuthSession("token")).resolves.toMatchObject({ userId: "user-1" });
  });

  it.each([null, { id: "user-1", isActive: false }])(
    "rejects a session for a missing or disabled account",
    async (account) => {
      mocks.getUserById.mockResolvedValue(account);

      await expect(verifyDashboardAuthToken("token")).resolves.toBe(false);
      await expect(getDashboardAuthSession("token")).resolves.toBeNull();
    }
  );

  it("does not preserve legacy marker-only OIDC sessions", async () => {
    mocks.jwtVerify.mockResolvedValue({ payload: { authenticated: true, oidc: true } });

    await expect(verifyDashboardAuthToken("legacy-token")).resolves.toBe(false);
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });
});
