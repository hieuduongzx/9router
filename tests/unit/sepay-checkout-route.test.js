import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardAccount: vi.fn(),
  createTopup: vi.fn(),
  getSePayConfig: vi.fn(),
  makeInvoiceNumber: vi.fn(),
}));

vi.mock("@/lib/auth/dashboardSession", () => ({ getDashboardAccount: mocks.getDashboardAccount }));
vi.mock("@/lib/db/index.js", () => ({ createTopup: mocks.createTopup }));
vi.mock("@/lib/payments/sepay.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getSePayConfig: mocks.getSePayConfig, makeInvoiceNumber: mocks.makeInvoiceNumber };
});

const { POST } = await import("../../src/app/api/account/topup/route.js");

function request(amountUsd) {
  return new Request("https://router.test/api/account/topup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountUsd }),
  });
}

describe("POST /api/account/topup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDashboardAccount.mockResolvedValue({ id: "user-1", creditCents: 0 });
    mocks.getSePayConfig.mockReturnValue({ bankCode: "TPB", bankAccount: "0123456789", accountName: "DUONG MINH HIEU", webhookApiKey: "webhook", vndPerUsd: 25000 });
    mocks.makeInvoiceNumber.mockReturnValue("R2KXYZF");
    mocks.createTopup.mockImplementation(async (value) => ({ id: "topup-1", status: "pending", ...value }));
  });

  it("requires an authenticated account", async () => {
    mocks.getDashboardAccount.mockResolvedValue(null);
    expect((await POST(request("10.00"))).status).toBe(401);
    expect(mocks.createTopup).not.toHaveBeenCalled();
  });

  it("rejects more than two decimal places", async () => {
    const response = await POST(request("10.001"));
    expect(response.status).toBe(400);
    expect(mocks.createTopup).not.toHaveBeenCalled();
  });

  it("calculates VND and returns an in-page VietQR payment", async () => {
    const response = await POST(request("10.25"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(mocks.createTopup).toHaveBeenCalledWith({ userId: "user-1", amountVnd: 256250, creditCents: 1025, invoiceNumber: "R2KXYZF" });
    expect(body.payment).toMatchObject({ bankCode: "TPB", bankAccount: "0123456789", accountName: "DUONG MINH HIEU", amountVnd: 256250, transferContent: "R2KXYZF" });
    expect(body.payment.qrUrl).toContain("img.vietqr.io/image/TPB-0123456789-compact2.png");
    expect(body.payment.qrUrl).toContain("amount=256250");
    expect(body.payment.qrUrl).toContain("addInfo=R2KXYZF");
  });
});
