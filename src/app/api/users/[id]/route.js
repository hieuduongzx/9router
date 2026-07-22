import { NextResponse } from "next/server";
import {
  adjustUserCredit,
  deleteUserAccount,
  setUserCreditBalance,
  updateUserAccess,
} from "@/lib/localDb";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";

async function requireAdmin(request) {
  const account = await getDashboardAccount(request);
  return account?.role === "admin" ? account : null;
}

export async function PATCH(request, { params }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const update = {};
    if (body.role !== undefined) update.role = body.role;
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });
      }
      update.isActive = body.isActive;
    }
    const hasCreditAdjustment = body.creditAdjustmentCents !== undefined;
    if (hasCreditAdjustment && !Number.isSafeInteger(body.creditAdjustmentCents)) {
      return NextResponse.json({ error: "creditAdjustmentCents must be a whole number" }, { status: 400 });
    }
    const hasCreditBalance = body.creditBalanceCents !== undefined;
    if (hasCreditBalance && !Number.isSafeInteger(body.creditBalanceCents)) {
      return NextResponse.json({ error: "creditBalanceCents must be a whole number" }, { status: 400 });
    }
    if (hasCreditAdjustment && hasCreditBalance) {
      return NextResponse.json({ error: "Choose either a credit adjustment or an exact balance" }, { status: 400 });
    }
    if ((hasCreditAdjustment || hasCreditBalance) && Object.keys(update).length > 0) {
      return NextResponse.json({ error: "Credit and access changes must be submitted separately" }, { status: 400 });
    }
    if (id === admin.id && (update.role === "user" || update.isActive === false)) {
      return NextResponse.json({ error: "You cannot change your own administrator access." }, { status: 400 });
    }
    if (Object.keys(update).length === 0 && !hasCreditAdjustment && !hasCreditBalance) {
      return NextResponse.json({ error: "No supported changes provided" }, { status: 400 });
    }

    let user;
    if (hasCreditBalance) {
      user = await setUserCreditBalance(id, body.creditBalanceCents, {
        actorUserId: admin.id,
        source: "admin_dashboard",
        note: body.note || "Balance set from Accounts",
      });
    } else if (hasCreditAdjustment) {
      user = await adjustUserCredit(id, body.creditAdjustmentCents, {
        actorUserId: admin.id,
        source: "admin_dashboard",
        note: body.note || (body.creditAdjustmentCents > 0 ? "Top-up from Accounts" : "Deduction from Accounts"),
      });
    } else {
      user = await updateUserAccess(id, update);
    }
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to update account" }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

    const { id } = await params;
    const deleted = await deleteUserAccount(id, admin.id);
    if (!deleted) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to delete account" }, { status: 400 });
  }
}
