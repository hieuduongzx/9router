import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isWebhookAuthorizationValid, isWebhookHmacValid, makeInvoiceNumber, makeVietQrUrl, normalizeInvoiceReference, parseUsdCents, snapshotHasInvoice } from "../../src/lib/payments/sepay.js";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let adapter;
let user;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "router2k-sepay-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
  adapter = await (await import("@/lib/db/driver.js")).getAdapter();
  await db.createUser({ username: "sepay.admin", email: "sepay.admin@example.com", password: "password-admin" });
  user = await db.createUser({ username: "sepay.user", email: "sepay.user@example.com", password: "password-user" });
});

beforeEach(() => {
  adapter.exec("DELETE FROM paymentTopups");
  adapter.exec("DELETE FROM creditLedger");
  adapter.run("UPDATE users SET creditCents = 0 WHERE id = ?", [user.id]);
});

afterAll(() => {
  adapter?.close?.();
  delete global._dbAdapter;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("SePay Webhooks wallet top-ups", () => {
  it("parses exact USD cents and validates Webhooks API Key", () => {
    expect(parseUsdCents("10")).toBe(1000);
    expect(parseUsdCents("10.25")).toBe(1025);
    expect(parseUsdCents("1.001")).toBeNull();
    expect(isWebhookAuthorizationValid("Apikey bank-secret", "bank-secret")).toBe(true);
    expect(isWebhookAuthorizationValid("Bearer bank-secret", "bank-secret")).toBe(false);
    expect(isWebhookHmacValid("sha256=" + "a".repeat(64), "1700000000", "{}", "secret", 1700000000)).toBe(false);
    expect(normalizeInvoiceReference("R2KXYZF")).toBe("R2KXYZF");
    expect(snapshotHasInvoice({ content: "r2kxyzf chuyen tien" }, "R2KXYZF")).toBe(true);
    expect(snapshotHasInvoice({ content: "R2K-XYZF chuyen tien" }, "R2KXYZF")).toBe(true);
    expect(snapshotHasInvoice({ content: "R2K XYZF chuyen tien" }, "R2KXYZF")).toBe(true);
  });

  it("mints one short unbroken transfer memo", () => {
    const invoice = makeInvoiceNumber();
    expect(invoice).toMatch(/^R2K[A-Z2-9]{4}$/);
    expect(invoice).not.toMatch(/[\s-]/);
    expect(new Set(Array.from({ length: 200 }, () => makeInvoiceNumber())).size).toBeGreaterThan(150);
  });

  it("builds an in-page VietQR URL with the exact memo", () => {
    const url = makeVietQrUrl({ bankCode: "TPB", bankAccount: "0123456789", accountName: "DUONG MINH HIEU", amountVnd: 256250, invoiceNumber: "R2KXYZF" });
    expect(url).toContain("img.vietqr.io/image/TPB-0123456789-compact2.png");
    expect(url).toContain("amount=256250");
    expect(url).toContain("addInfo=R2KXYZF");
  });

  it("settles once, rejects mismatches, and writes one ledger entry", async () => {
    await db.createTopup({ userId: user.id, invoiceNumber: "R2KPAID", amountVnd: 250000, creditCents: 1000 });
    expect(snapshotHasInvoice({ content: "Thanh toan R2KPAID" }, "R2KPAID")).toBe(true);
    expect((await db.settleTopup({ invoiceNumber: "R2KPAID", amountVnd: 249000, sepayOrderId: "ref-1", sepayTransactionId: "tx-1" })).code).toBe("amount_mismatch");
    const paid = await db.settleTopup({ invoiceNumber: "R2KPAID", amountVnd: 250000, sepayOrderId: "ref-1", sepayTransactionId: "tx-1", paymentMethod: "BANK_TRANSFER" });
    expect(paid).toMatchObject({ ok: true, duplicate: false, creditCents: 1000 });
    const replay = await db.settleTopup({ invoiceNumber: "R2KPAID", amountVnd: 250000, sepayOrderId: "ref-1", sepayTransactionId: "tx-1" });
    expect(replay).toMatchObject({ ok: true, duplicate: true });
    expect((await db.getUserById(user.id)).creditCents).toBe(1000);
    expect((await db.listCreditLedger(user.id)).entries).toHaveLength(1);
  });

  it("matches a mangled memo back to its pending top-up", async () => {
    await db.createTopup({ userId: user.id, invoiceNumber: "R2KQWRT", amountVnd: 125000, creditCents: 500 });
    const matched = await db.getTopupByWebhookContent("CT DEN:9704 r2k-qwrt chuyen tien");
    expect(matched?.invoiceNumber).toBe("R2KQWRT");
    expect(await db.getTopupByWebhookContent("CT DEN:9704 chuyen tien")).toBeNull();
  });
});
