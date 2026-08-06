/**
 * Shared pricing helpers for published model routes.
 *
 * Rates are USD per one million tokens. A route's pricing key is its owner
 * provider plus its public model id — see comboPricingTarget in
 * lib/publishedModelsCatalog.js for the server-side counterpart.
 */

export const PRICING_FIELDS = [
  ["input", "Input"],
  ["output", "Output"],
  ["cached", "Cached"],
  ["reasoning", "Reasoning"],
  ["cache_creation", "Cache create"],
];

/** The two rates shown as editable columns; the rest live behind the modal. */
export const INLINE_PRICING_FIELDS = ["input", "output"];

const RATE_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

export function formatRate(value) {
  return Number.isFinite(Number(value)) ? `$${RATE_FORMAT.format(Number(value))}` : "—";
}

/** Unpriced and all-zero both read as free to the caller, so treat them alike. */
export function isFreePricing(pricing) {
  if (pricing == null || typeof pricing !== "object") return pricing == null;
  const hasAnyRate = PRICING_FIELDS.some(([field]) => {
    const value = pricing[field];
    return value != null && value !== "";
  });
  if (!hasAnyRate) return true;
  return PRICING_FIELDS.every(([field]) => {
    const value = pricing[field];
    if (value == null || value === "") return true;
    return Number(value) === 0;
  });
}

export function freePricing() {
  return Object.fromEntries(PRICING_FIELDS.map(([field]) => [field, 0]));
}

export function draftFromPricing(pricing = {}) {
  return Object.fromEntries(
    PRICING_FIELDS.map(([field]) => {
      const value = pricing[field];
      return [field, value == null || value === "" ? "" : String(value)];
    }),
  );
}

export function draftLooksFree(draft) {
  return isFreePricing(draft || {});
}

/** Turn a form draft into a complete rate object, throwing on invalid input. */
export function parseDraft(draft, { basePricing = {}, free = false } = {}) {
  if (free) return freePricing();

  const pricing = { ...(basePricing || {}) };
  for (const [field, label] of PRICING_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(draft || {}, field)) continue;
    const raw = String(draft[field] ?? "").trim();
    if (raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${label} must be a non-negative number.`);
    }
    pricing[field] = value;
  }
  for (const [field] of PRICING_FIELDS) {
    if (!Number.isFinite(Number(pricing[field]))) pricing[field] = 0;
  }
  return pricing;
}

export function pricingChanged(current = {}, next = {}) {
  return PRICING_FIELDS.some(([field]) => Number(current[field] || 0) !== Number(next[field] || 0));
}

/** Compact "in / out" summary used by table cells. */
export function formatRateSummary(pricing) {
  if (isFreePricing(pricing)) return "Free";
  if (!pricing) return "—";
  return `${formatRate(pricing.input)} / ${formatRate(pricing.output)}`;
}
