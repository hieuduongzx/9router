import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUserById } from "@/lib/db/repos/usersRepo";
import {
  DEFAULT_USER_TOKEN_SAVER_SETTINGS,
  getUserTokenSaverSettings,
  updateUserSettings,
} from "@/lib/db/repos/userSettingsRepo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

async function requireAccount() {
  const cookieStore = await cookies();
  const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
  if (!session?.userId) return null;
  return await getUserById(session.userId);
}

// Only token-saver preference keys may be mass-assigned; everything else stays
// host-wide (admin-managed) and is rejected here.
function sanitizeTokenSaverPatch(body) {
  const patch = {};
  for (const key of Object.keys(DEFAULT_USER_TOKEN_SAVER_SETTINGS)) {
    if (Object.prototype.hasOwnProperty.call(body || {}, key)) {
      patch[key] = body[key];
    }
  }
  return patch;
}

export async function GET() {
  try {
    const account = await requireAccount();
    if (!account) {
      return NextResponse.json({ error: "Account login required." }, { status: 401, headers: NO_STORE_HEADERS });
    }
    const settings = await getUserTokenSaverSettings(account.id);
    return NextResponse.json(settings, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.log("Error getting token saver settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function PATCH(request) {
  try {
    const account = await requireAccount();
    if (!account) {
      return NextResponse.json({ error: "Account login required." }, { status: 401, headers: NO_STORE_HEADERS });
    }
    const body = await request.json().catch(() => ({}));
    const patch = sanitizeTokenSaverPatch(body);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No token saver settings to update." }, { status: 400, headers: NO_STORE_HEADERS });
    }
    const settings = await updateUserSettings(account.id, patch);
    return NextResponse.json(settings, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.log("Error updating token saver settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
