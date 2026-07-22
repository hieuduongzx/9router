import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/localDb";
import { createUser, USER_ROLES } from "@/lib/db/repos/usersRepo";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";
import { isOidcConfigured } from "@/lib/auth/oidc";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };


export async function POST(request) {
  try {
    const settings = await getSettings();
    if (settings.authMode === "oidc" && isOidcConfigured(settings)) {
      return NextResponse.json({ error: "Account registration is disabled while OIDC-only login is active." }, { status: 403 });
    }

    const body = await request.json();
    const signupCreditCents = Number.isSafeInteger(settings.signupCreditCents)
      ? Math.max(0, settings.signupCreditCents)
      : 0;
    const user = await createUser({
      username: body?.username,
      email: body?.email,
      password: body?.password,
      role: USER_ROLES.USER,
      initialCreditCents: signupCreditCents,
    });

    const cookieStore = await cookies();
    await setDashboardAuthCookie(cookieStore, request, {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      authType: "account",
    });

    return NextResponse.json({ success: true, user }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    const duplicate = ["USERNAME_EXISTS", "EMAIL_EXISTS", "ACCOUNT_EXISTS"].includes(error?.code);
    return NextResponse.json(
      { error: error?.message || "Registration failed." },
      { status: duplicate ? 409 : 400, headers: NO_STORE_HEADERS }
    );
  }
}
