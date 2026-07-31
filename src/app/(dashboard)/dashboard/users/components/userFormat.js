/** Shared formatters for the admin Accounts list and account detail pages. */

const DATE_FORMAT = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
export const COMPACT_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export const CREDIT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});
export const COST_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : DATE_FORMAT.format(parsed);
}

export function formatDateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : DATE_TIME_FORMAT.format(parsed);
}

export function formatCredit(creditCents = 0) {
  return CREDIT_FORMAT.format((creditCents || 0) / 100);
}

export function formatSignedCredit(creditCents = 0) {
  const amount = CREDIT_FORMAT.format(Math.abs(creditCents || 0) / 100);
  if ((creditCents || 0) > 0) return `+${amount}`;
  if ((creditCents || 0) < 0) return `-${amount}`;
  return amount;
}

export function initials(username) {
  return String(username || "?").trim().charAt(0).toUpperCase() || "?";
}

/** Keep the first 6 and last 4 characters of an API key readable, mask the rest. */
export function maskKey(fullKey) {
  if (!fullKey || fullKey.length <= 10) return fullKey || "";
  return fullKey.slice(0, 6) + "•".repeat(Math.min(fullKey.length - 10, 24)) + fullKey.slice(-4);
}

export function ledgerLabel(entry) {
  if (entry?.note) return entry.note;
  switch (entry?.type) {
    case "signup_bonus": return "Signup credit";
    case "usage": return "API usage charge";
    case "topup": return "Top-up";
    case "deduction": return "Deduction";
    case "set_balance": return "Balance set";
    default: return entry?.type || "Adjustment";
  }
}
