import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  json: vi.fn((body, init = {}) => ({ body, status: init.status || 200, headers: init.headers })),
  cookieSet: vi.fn(),
  getSettings: vi.fn(),
  verifyUserCredentials: vi.fn(),
  createUser: vi.fn(),
  setDashboardAuthCookie: vi.fn(),
  checkLock: vi.fn(),
  recordFail: vi.fn(),
  recordSuccess: vi.fn(),
  getDashboardAccount: vi.fn(),
  verifyUserPassword: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserPassword: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: mocks.json },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: mocks.cookieSet })),
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: mocks.getSettings,
  verifyUserPassword: mocks.verifyUserPassword,
  updateUserProfile: mocks.updateUserProfile,
  updateUserPassword: mocks.updateUserPassword,
}));

vi.mock("@/lib/db/repos/usersRepo", () => ({
  USER_ROLES: { ADMIN: "admin", USER: "user" },
  publicUser: (user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  }),
  verifyUserCredentials: mocks.verifyUserCredentials,
  createUser: mocks.createUser,
}));

vi.mock("@/lib/auth/dashboardSession", () => ({
  setDashboardAuthCookie: mocks.setDashboardAuthCookie,
  getDashboardAccount: mocks.getDashboardAccount,
}));

vi.mock("@/lib/auth/oidc", () => ({
  isOidcConfigured: vi.fn(() => false),
}));

vi.mock("@/lib/auth/loginLimiter", () => ({
  checkLock: mocks.checkLock,
  recordFail: mocks.recordFail,
  recordSuccess: mocks.recordSuccess,
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/dashboardGuard", () => ({
  isLocalRequest: vi.fn(() => true),
}));

const { POST: login } = await import("../../src/app/api/auth/login/route.js");
const { POST: register } = await import("../../src/app/api/auth/register/route.js");
const { PUT: updateProfile } = await import("../../src/app/api/account/profile/route.js");
const { PUT: updatePassword } = await import("../../src/app/api/account/password/route.js");

function request(body) {
  return {
    json: vi.fn(async () => body),
    headers: new Headers({ host: "localhost:20127" }),
  };
}

const admin = {
  id: "admin-id",
  username: "admin",
  email: "admin@localhost",
  role: "admin",
  isActive: true,
  mustChangePassword: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSettings.mockResolvedValue({ authMode: "password" });
  mocks.checkLock.mockReturnValue({ locked: false, retryAfter: 0 });
  mocks.recordFail.mockReturnValue({ remainingBeforeLock: 4 });
  mocks.getDashboardAccount.mockResolvedValue(admin);
  mocks.verifyUserPassword.mockResolvedValue(true);
});

describe("account login", () => {
  it("sets an identity cookie with the persisted admin role", async () => {
    mocks.verifyUserCredentials.mockResolvedValue(admin);

    const response = await login(request({ username: "admin", password: "admin" }));

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("admin");
    expect(mocks.setDashboardAuthCookie).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ userId: "admin-id", username: "admin", role: "admin", authType: "account" }),
      // 4th arg carries the "keep me signed in" choice; absent in the body → false.
      { remember: false }
    );
  });

  it("rejects an invalid username or password without exposing which field failed", async () => {
    mocks.verifyUserCredentials.mockResolvedValue(null);

    const response = await login(request({ username: "missing", password: "wrong" }));

    expect(response.status).toBe(401);
    expect(response.body.error).toContain("Invalid username/email or password");
  });
});

describe("account registration", () => {
  it("always creates public registrations with the user role", async () => {
    const created = {
      id: "user-id",
      username: "member",
      email: "member@example.com",
      role: "user",
      isActive: true,
      mustChangePassword: false,
    };
    mocks.createUser.mockResolvedValue(created);

    const response = await register(request({
      username: "member",
      email: "member@example.com",
      password: "secret123",
      role: "admin",
    }));

    expect(response.status).toBe(201);
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: "user" }));
    expect(response.body.user.role).toBe("user");
    expect(mocks.setDashboardAuthCookie).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ userId: "user-id", role: "user", authType: "account" }),
      { remember: false }
    );
  });
});

describe("self-service account profile", () => {
  it("updates the signed-in identity after current-password verification", async () => {
    const updated = { ...admin, username: "admin.ops", email: "ops@example.com" };
    mocks.updateUserProfile.mockResolvedValue(updated);

    const response = await updateProfile(request({
      username: "admin.ops",
      email: "ops@example.com",
      currentPassword: "current-password",
    }));

    expect(response.status).toBe(200);
    expect(mocks.verifyUserPassword).toHaveBeenCalledWith("admin-id", "current-password");
    expect(mocks.updateUserProfile).toHaveBeenCalledWith("admin-id", {
      username: "admin.ops",
      email: "ops@example.com",
    });
    expect(response.body.user).toEqual(updated);
  });

  it("rejects identity changes when the current password is wrong", async () => {
    mocks.verifyUserPassword.mockResolvedValue(false);

    const response = await updateProfile(request({
      username: "admin.ops",
      email: "ops@example.com",
      currentPassword: "wrong-password",
    }));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Current password is incorrect");
    expect(mocks.updateUserProfile).not.toHaveBeenCalled();
  });

  it("returns a conflict for an identity already in use", async () => {
    const conflict = new Error("Username is already registered.");
    conflict.code = "USERNAME_EXISTS";
    mocks.updateUserProfile.mockRejectedValue(conflict);

    const response = await updateProfile(request({
      username: "member",
      email: "admin@localhost",
      currentPassword: "current-password",
    }));

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Username is already registered.");
  });

  it("enforces the product password minimum on the server", async () => {
    const response = await updatePassword(request({
      currentPassword: "current-password",
      newPassword: "short7",
    }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("at least 8 characters");
    expect(mocks.updateUserPassword).not.toHaveBeenCalled();
  });
});
