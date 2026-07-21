import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/localDb";
import { publicUser, verifyUserCredentials } from "@/lib/db/repos/usersRepo";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";
import { isOidcConfigured } from "@/lib/auth/oidc";
import { checkLock, recordFail, recordSuccess, getClientIp } from "@/lib/auth/loginLimiter";

const RESET_HINT = "Forgot your account password? Generate a one-time recovery password from the local Router2k CLI (9router) → Settings → Reset Admin Account.";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };


export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    const password = body?.password;
    const ip = getClientIp(request);
    const limiterKey = `${ip}:${username.toLowerCase() || "unknown"}`;
    const lock = checkLock(limiterKey);

    if (lock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${lock.retryAfter}s.`, retryAfter: lock.retryAfter, resetHint: RESET_HINT },
        { status: 429, headers: { ...NO_STORE_HEADERS, "Retry-After": String(lock.retryAfter) } }
      );
    }

    if (!username || typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const settings = await getSettings();
    if (settings.authMode === "oidc" && isOidcConfigured(settings)) {
      return NextResponse.json({ error: "Account login is disabled. Use OIDC sign in." }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const user = await verifyUserCredentials(username, password);
    if (user) {
      recordSuccess(limiterKey);
      const cookieStore = await cookies();
      await setDashboardAuthCookie(cookieStore, request, {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        authType: "account",
      });

      return NextResponse.json({
        success: true,
        user: publicUser(user),
        mustChangePassword: user.mustChangePassword,
      }, { headers: NO_STORE_HEADERS });
    }

    const { remainingBeforeLock } = recordFail(limiterKey);
    const postLock = checkLock(limiterKey);
    if (postLock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${postLock.retryAfter}s.`, retryAfter: postLock.retryAfter, resetHint: RESET_HINT },
        { status: 429, headers: { ...NO_STORE_HEADERS, "Retry-After": String(postLock.retryAfter) } }
      );
    }

    return NextResponse.json(
      { error: `Invalid username/email or password. ${remainingBeforeLock} attempt(s) left before lockout.`, remainingBeforeLock },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Login failed." }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
