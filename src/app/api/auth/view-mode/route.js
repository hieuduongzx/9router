import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAccount, shouldUseSecureCookie } from "@/lib/auth/dashboardSession";
import {
  DASHBOARD_VIEW_ADMIN,
  DASHBOARD_VIEW_COOKIE,
  DASHBOARD_VIEW_USER,
} from "@/shared/constants/dashboardView";

const VALID_MODES = new Set([DASHBOARD_VIEW_ADMIN, DASHBOARD_VIEW_USER]);
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(request) {
  const account = await getDashboardAccount(request);
  if (account?.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const body = await request.json().catch(() => ({}));
  if (!VALID_MODES.has(body.mode)) {
    return NextResponse.json(
      { error: "Invalid dashboard view mode" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(DASHBOARD_VIEW_COOKIE, body.mode, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json(
    {
      viewMode: body.mode,
      isAdminView: body.mode === DASHBOARD_VIEW_ADMIN,
    },
    { headers: NO_STORE_HEADERS },
  );
}
