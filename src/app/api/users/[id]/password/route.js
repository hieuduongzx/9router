import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { getUserById, publicUser, updateUserPassword } from "@/lib/db/index.js";

export const dynamic = "force-dynamic";

/**
 * Administrator password reset. Either sets the supplied password or generates a
 * temporary one that is returned exactly once — the stored hash is never readable.
 */
export async function POST(request, { params }) {
  try {
    const account = await getDashboardAccount(request);
    if (!account || account.role !== "admin") {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }

    const { id } = await params;
    const target = await getUserById(id);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const generated = !body.password;
    const password = generated ? randomBytes(12).toString("base64url") : String(body.password);
    // A generated password is unknown to its owner, so it must always be changed on
    // first sign-in; an admin-chosen one only when explicitly requested.
    const mustChangePassword = generated ? true : body.mustChangePassword !== false;

    const updated = await updateUserPassword(id, password, { mustChangePassword });
    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      success: true,
      mustChangePassword,
      temporaryPassword: generated ? password : undefined,
      user: publicUser(await getUserById(id)),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to reset password" }, { status: 400 });
  }
}
