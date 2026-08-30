import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settleTopup: vi.fn(),
  getTopupByWebhookContent: vi.fn(),
  getSePayConfig: vi.fn(),
}));

vi.mock("@/lib/db/index.js", () => ({
  settleTopup: mocks.settleTopup,
  getTopupByWebhookContent: mocks.getTopupByWebhookContent,
}));
vi.mock("@/lib/payments/sepay.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getSePayConfig: mocks.getSePayConfig,
}));

const { POST } = await import("../../src/app/api/payments/sepay/ipn/route.js");

function makeRequest(apiKey = "webhook-key", overrides = {}, extraHeaders = {}) {
  const body = {
    id: 92704,
    gateway: "Vietcombank",
    transactionDate: "2026-08-29 12:00:00",
    accountNumber: "0123456789",
    subAccount: "",
    code: null,
    content: "R2KXYZF chuyen tien",
    transferType: "in",
    description: "NGUYEN VAN A chuyen tien",
    transferAmount: 250000,
    accumulated: 1000000,
    referenceCode: "FT123",
    ...overrides,
  };
  const headers = { "Content-Type": "application/json", Authorization: `Apikey ${apiKey}`, ...extraHeaders };
  return new Request("https://router.test/api/payments/sepay/ipn", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/payments/sepay/ipn SePay Webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSePayConfig.mockReturnValue({ webhookApiKey: "webhook-key", webhookSecret: null, bankAccount: "0123456789" });
    mocks.getTopupByWebhookContent.mockResolvedValue({ id: "topup-1", userId: "user-1", invoiceNumber: "R2KXYZF", amountVnd: 250000, creditCents: 1000, status: "pending" });
    mocks.settleTopup.mockResolvedValue({ ok: true, duplicate: false });
  });

  it("requires Webhooks API Key authorization", async () => {
    const response = await POST(makeRequest("wrong"));
    expect(response.status).toBe(401);
    expect(mocks.getTopupByWebhookContent).not.toHaveBeenCalled();
  });

  it("rejects outgoing transfers and wrong receiving account", async () => {
    expect((await POST(makeRequest("webhook-key", { transferType: "out" }))).status).toBe(400);
    expect((await POST(makeRequest("webhook-key", { accountNumber: "999999" }))).status).toBe(400);
    expect(mocks.settleTopup).not.toHaveBeenCalled();
  });

  it("settles a matching incoming webhook and returns exact acknowledgement", async () => {
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.settleTopup).toHaveBeenCalledWith(expect.objectContaining({ invoiceNumber: "R2KXYZF", amountVnd: 250000, sepayTransactionId: "92704" }));
  });

  it("looks up a mangled memo without separators", async () => {
    const response = await POST(makeRequest("webhook-key", { content: "CT DEN:9704 r2kxyzf" }));
    expect(response.status).toBe(200);
    expect(mocks.getTopupByWebhookContent).toHaveBeenCalledWith("CT DEN:9704 r2kxyzf");
  });

  it("acknowledges a valid incoming transaction with an unknown invoice", async () => {
    mocks.getTopupByWebhookContent.mockResolvedValue(null);
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.settleTopup).not.toHaveBeenCalled();
  });
});
