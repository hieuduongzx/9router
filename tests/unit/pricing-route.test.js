import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getPricing: vi.fn(),
  updatePricing: vi.fn(),
  resetPricing: vi.fn(),
  resetAllPricing: vi.fn(),
  getDefaultPricing: vi.fn(),
  canEditPricing: vi.fn(),
}));

vi.mock("next/server", () => ({ NextResponse: { json: (body, init) => Response.json(body, init) } }));
vi.mock("@/lib/localDb.js", () => ({
  getPricing: mocks.getPricing,
  updatePricing: mocks.updatePricing,
  resetPricing: mocks.resetPricing,
  resetAllPricing: mocks.resetAllPricing,
}));
vi.mock("open-sse/providers/pricing.js", () => ({ getDefaultPricing: mocks.getDefaultPricing }));
vi.mock("@/lib/auth/pricingAccess", () => ({ canEditPricing: mocks.canEditPricing }));

const { GET, GET_DEFAULTS, PATCH, DELETE } = await import("@/app/api/pricing/route.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPricing.mockResolvedValue({ openai: { "gpt-4o": { input: 2, output: 8 } } });
  mocks.getDefaultPricing.mockReturnValue({ openai: { "gpt-4o": { input: 2.5, output: 10 } } });
  mocks.updatePricing.mockResolvedValue({ saved: true });
  mocks.canEditPricing.mockResolvedValue(true);
});

describe("/api/pricing", () => {
  it("GET resolves current pricing", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ openai: { "gpt-4o": { input: 2, output: 8 } } });
    expect(mocks.getPricing).toHaveBeenCalledOnce();
  });

  it("GET_DEFAULTS returns built-in pricing", async () => {
    const response = await GET_DEFAULTS();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ openai: { "gpt-4o": { input: 2.5, output: 10 } } });
    expect(mocks.getDefaultPricing).toHaveBeenCalledOnce();
  });

  it.each([
    ["model", "?provider=openai&model=gpt-4o", ["openai", "gpt-4o"]],
    ["provider", "?provider=openai", ["openai"]],
    ["all", "", []],
  ])("DELETE resets %s pricing", async (_kind, query, args) => {
    const response = await DELETE(new Request(`http://localhost/api/pricing${query}`, { method: "DELETE" }));
    expect(response.status).toBe(200);
    expect(mocks.resetPricing).toHaveBeenCalledTimes(args.length ? 1 : 0);
    if (args.length) expect(mocks.resetPricing).toHaveBeenCalledWith(...args);
    else expect(mocks.resetAllPricing).toHaveBeenCalledOnce();
    expect(mocks.getPricing).toHaveBeenCalledOnce();
  });

  it("denies PATCH for non-admins without writing", async () => {
    mocks.canEditPricing.mockResolvedValue(false);
    const response = await PATCH(new Request("http://localhost/api/pricing", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ openai: {} }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.updatePricing).not.toHaveBeenCalled();
  });

  it("denies DELETE for non-admins without resetting", async () => {
    mocks.canEditPricing.mockResolvedValue(false);
    const response = await DELETE(new Request("http://localhost/api/pricing?provider=openai", { method: "DELETE" }));
    expect(response.status).toBe(403);
    expect(mocks.resetPricing).not.toHaveBeenCalled();
    expect(mocks.resetAllPricing).not.toHaveBeenCalled();
  });
});
