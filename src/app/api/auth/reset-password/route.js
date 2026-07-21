import { NextResponse } from "next/server";
import { resetRecoveryAdminCredentials } from "@/lib/db/repos/usersRepo";

// Local-only (enforced by dashboardGuard). Generates a one-time recovery
// password and requires a password change before remote access.
export async function POST() {
  try {
    const { user, temporaryPassword } = await resetRecoveryAdminCredentials();
    return NextResponse.json({
      success: true,
      username: user.username,
      temporaryPassword,
      message: "A temporary administrator password was generated.",
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to reset admin account." }, { status: 500 });
  }
}
