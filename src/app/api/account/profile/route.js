import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { updateUserProfile, verifyUserPassword } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function PUT(request) {
  const account = await getDashboardAccount(request);
  if (!account) {
    return NextResponse.json({ error: "Account login required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const currentPassword = String(body?.currentPassword || "");
    const username = String(body?.username || "");
    const email = String(body?.email || "");

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    if (!(await verifyUserPassword(account.id, currentPassword))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const user = await updateUserProfile(account.id, { username, email });
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    const status = error?.code === "USERNAME_EXISTS" || error?.code === "EMAIL_EXISTS" ? 409 : 400;
    return NextResponse.json(
      { error: error?.message || "Unable to update profile" },
      { status },
    );
  }
}
