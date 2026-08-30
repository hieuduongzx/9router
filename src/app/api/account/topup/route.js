import { NextResponse } from "next/server";
import { getDashboardAccount } from "@/lib/auth/dashboardSession";
import { createTopup } from "@/lib/db/index.js";
import { getSePayConfig, makeInvoiceNumber, makeVietQrUrl, parseUsdCents } from "@/lib/payments/sepay.js";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const MAX_CREDIT_CENTS = 100_000_000;

export async function POST(request) {
  try {
    const account = await getDashboardAccount(request);
    if (!account?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    const config = getSePayConfig();
    const body = await request.json().catch(() => ({}));
    const creditCents = parseUsdCents(body?.amountUsd);
    if (!creditCents || creditCents > MAX_CREDIT_CENTS) {
      return NextResponse.json({ error: "Amount must be between $0.01 and $1,000,000.00" }, { status: 400, headers: NO_STORE });
    }
    if ((Number(account.creditCents) || 0) + creditCents > MAX_CREDIT_CENTS) {
      return NextResponse.json({ error: "Top-up would exceed the $1,000,000.00 wallet limit" }, { status: 400, headers: NO_STORE });
    }
    const amountVnd = creditCents * config.vndPerUsd / 100;
    if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0) {
      return NextResponse.json({ error: "Amount cannot be converted to whole VND" }, { status: 400, headers: NO_STORE });
    }
    // Short memo codes collide occasionally; invoiceNumber is UNIQUE, so retry
    // with a fresh code instead of failing the user's top-up.
    let invoiceNumber = "";
    let topup = null;
    for (let attempt = 0; attempt < 8 && !topup; attempt += 1) {
      invoiceNumber = makeInvoiceNumber();
      try {
        topup = await createTopup({ userId: account.id, amountVnd, creditCents, invoiceNumber });
      } catch (error) {
        if (!/UNIQUE|constraint/i.test(String(error?.message || ""))) throw error;
      }
    }
    if (!topup) throw new Error("Unable to allocate a transfer code, please try again");
    return NextResponse.json({
      topup,
      payment: {
        bankCode: config.bankCode,
        bankAccount: config.bankAccount,
        accountName: config.accountName,
        amountVnd,
        transferContent: invoiceNumber,
        qrUrl: makeVietQrUrl({ ...config, amountVnd, invoiceNumber }),
      },
    }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Unable to create top-up" }, { status: 400, headers: NO_STORE });
  }
}
