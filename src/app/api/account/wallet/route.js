import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { getUserById, listCreditLedger, listTopups } from "@/lib/localDb";
import { getSePayConfig } from "@/lib/payments/sepay.js";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request) {
  try {
    const account = await getDashboardAccount(request);
    if (!account?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 50);
    const offset = Number(url.searchParams.get("offset") || 0);
    // Wallet history tracks balance changes only (top-ups, admin adjustments,
    // coupons). Per-request API spend lives on the Usage page.
    const includeUsage = false;

    const user = await getUserById(account.id);
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404, headers: NO_STORE });
    }

    const ledger = await listCreditLedger(account.id, { limit, offset, includeUsage });
    const topups = await listTopups(account.id, { limit });
    let sepay = { enabled: false, vndPerUsd: null, bankCode: null, bankAccount: null, accountName: null };
    try {
      const config = getSePayConfig();
      sepay = { enabled: true, vndPerUsd: config.vndPerUsd, bankCode: config.bankCode, bankAccount: config.bankAccount, accountName: config.accountName };
    } catch {}
    return NextResponse.json(
      {
        balanceCents: user.creditCents || 0,
        topups,
        sepay,
        ...ledger,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to load wallet" },
      { status: 500, headers: NO_STORE },
    );
  }
}
