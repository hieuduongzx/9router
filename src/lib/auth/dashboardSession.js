import { SignJWT, jwtVerify } from "jose";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "@/lib/dataDir";
import { getUserById, verifyUserPassword } from "@/lib/db/repos/usersRepo";

function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, "jwt-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {}
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

const SECRET = new TextEncoder().encode(loadJwtSecret());

export function shouldUseSecureCookie(request) {
  const forceSecureCookie = process.env.AUTH_COOKIE_SECURE === "true";
  const forwardedProto = request?.headers?.get?.("x-forwarded-proto");
  const isHttpsRequest = forwardedProto === "https";
  return forceSecureCookie || isHttpsRequest;
}

// Session lifetime: a plain sign-in lasts a browser session (cookie dropped on
// browser close, token good for 24h); "remember me" persists the cookie on disk.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function sessionMaxAge(remember) {
  return remember ? REMEMBER_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
}

export async function createDashboardAuthToken(claims = {}, { remember = false } = {}) {
  return new SignJWT({ authenticated: true, remember: remember === true, ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAge(remember)}s`)
    .sign(SECRET);
}

function hasSessionIdentity(payload) {
  return payload?.authenticated === true && !!payload.userId;
}

async function hasActiveSessionAccount(payload) {
  if (!hasSessionIdentity(payload)) return false;
  const user = await getUserById(payload.userId);
  return user?.isActive === true;
}

export async function verifyDashboardAuthToken(token) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return await hasActiveSessionAccount(payload);
  } catch {
    return false;
  }
}

export async function getDashboardAuthSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return await hasActiveSessionAccount(payload) ? payload : null;
  } catch {
    return null;
  }
}
export async function getDashboardAccount(request) {
  const token = request?.cookies?.get?.("auth_token")?.value;
  const session = await getDashboardAuthSession(token);
  if (!session?.userId) return null;
  const user = await getUserById(session.userId);
  return user?.isActive ? user : null;
}


export async function setDashboardAuthCookie(cookieStore, request, claims = {}, { remember = false } = {}) {
  const token = await createDashboardAuthToken(claims, { remember });
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax",
    path: "/",
    // Omitting maxAge keeps it a session cookie, which is what a non-remembered
    // sign-in wants; "remember me" pins it for 30 days across browser restarts.
    ...(remember ? { maxAge: REMEMBER_MAX_AGE_SECONDS } : {}),
  });
}

export function clearDashboardAuthCookie(cookieStore) {
  cookieStore.delete("auth_token");
}

// Sliding renewal: once a live session is past half its lifetime, reissue it so
// an operator who keeps using the dashboard is never dropped at the hard expiry.
// No-op for fresh tokens, so it costs one cheap check per status poll.
export async function renewDashboardAuthCookie(cookieStore, request, session) {
  if (!session?.authenticated) return false;
  const { iat, exp, authenticated, remember, ...claims } = session;
  if (!Number.isFinite(exp)) return false;

  const remainingSeconds = exp - Math.floor(Date.now() / 1000);
  if (remainingSeconds <= 0) return false;
  if (remainingSeconds > sessionMaxAge(remember === true) / 2) return false;

  await setDashboardAuthCookie(cookieStore, request, claims, { remember: remember === true });
  return true;
}

// Verify the current dashboard password (re-auth for sensitive actions).
export async function verifyDashboardPassword(password, token) {
  if (typeof password !== "string" || !password) return false;
  const session = await getDashboardAuthSession(token);
  if (!session?.userId) return false;
  return verifyUserPassword(session.userId, password);
}
