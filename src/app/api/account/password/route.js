import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { updateUserPassword, verifyUserPassword } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function PUT(request) {
  const account = await getDashboardAccount(request);
  if (!account) {
    return NextResponse.json({ error: "Account login required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const currentPassword = String(body?.currentPassword || "");
    const newPassword = String(body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new passwords are required" },
        { status: 400 },
      );
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    if (!(await verifyUserPassword(account.id, currentPassword))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    await updateUserPassword(account.id, newPassword);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to update password" },
      { status: 400 },
    );
  }
}
