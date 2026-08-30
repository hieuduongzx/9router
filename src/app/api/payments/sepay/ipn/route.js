import { NextResponse } from "next/server";
import { getTopupByWebhookContent, settleTopup } from "@/lib/db/index.js";
import {
  getSePayConfig,
  isWebhookAuthorizationValid,
  isWebhookHmacValid,
  snapshotHasInvoice,
  webhookTransactionSnapshot,
} from "@/lib/payments/sepay.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const config = getSePayConfig();
    const rawBody = await request.text();
    const signature = request.headers.get("x-sepay-signature");
    const timestamp = request.headers.get("x-sepay-timestamp");
    const hmacValid = config.webhookSecret && signature
      ? isWebhookHmacValid(signature, timestamp, rawBody, config.webhookSecret)
      : false;
    const apiKeyValid = config.webhookApiKey
      ? isWebhookAuthorizationValid(request.headers.get("authorization"), config.webhookApiKey)
      : false;
    if (!hmacValid && !apiKeyValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = JSON.parse(rawBody);
    const snapshot = webhookTransactionSnapshot(data);
    if (!Number.isSafeInteger(Number(snapshot.id))
      || snapshot.accountNumber !== config.bankAccount
      || snapshot.transferType !== "in"
      || !Number.isSafeInteger(Number(snapshot.transferAmount))
      || Number(snapshot.transferAmount) <= 0) {
      return NextResponse.json({ error: "Invalid bank transaction webhook" }, { status: 400 });
    }

    const topup = await getTopupByWebhookContent(snapshot.content);
    if (!topup || !snapshotHasInvoice(snapshot, topup.invoiceNumber)) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const result = await settleTopup({
      invoiceNumber: topup.invoiceNumber,
      sepayOrderId: snapshot.referenceCode || String(snapshot.id),
      sepayTransactionId: String(snapshot.id),
      amountVnd: Number(snapshot.transferAmount),
      paymentMethod: "BANK_TRANSFER",
      rawData: snapshot,
    });
    if (!result.ok) {
      const status = ["amount_mismatch", "payment_reused"].includes(result.code)
        ? 409
        : result.code === "topup_not_found" ? 404 : 400;
      return NextResponse.json({ error: result.code }, { status });
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Unable to process bank webhook" }, { status: 500 });
  }
}
