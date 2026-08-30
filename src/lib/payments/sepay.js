import crypto from "node:crypto";

function optionalEnv(name) {
  const value = String(process.env[name] || "").trim();
  return value || null;
}

function requiredEnv(name) {
  const value = optionalEnv(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function getSePayConfig() {
  const vndPerUsd = Number(process.env.SEPAY_VND_PER_USD);
  if (!Number.isSafeInteger(vndPerUsd) || vndPerUsd <= 0) {
    throw new Error("Missing or invalid SEPAY_VND_PER_USD");
  }
  const webhookApiKey = optionalEnv("SEPAY_WEBHOOK_API_KEY");
  const webhookSecret = optionalEnv("SEPAY_WEBHOOK_SECRET");
  if (!webhookApiKey && !webhookSecret) {
    throw new Error("Missing SEPAY_WEBHOOK_API_KEY or SEPAY_WEBHOOK_SECRET");
  }
  return {
    vndPerUsd,
    bankCode: requiredEnv("SEPAY_BANK_CODE"),
    bankAccount: requiredEnv("SEPAY_BANK_ACCOUNT"),
    accountName: requiredEnv("SEPAY_BANK_ACCOUNT_NAME"),
    webhookApiKey,
    webhookSecret,
  };
}

export function parseUsdCents(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

// Bank transfer memos get mangled by every app in the chain: separators vanish,
// letters get lower-cased, long codes get truncated. One short unbroken token
// survives that, and matching normalizes both sides anyway.
const INVOICE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVOICE_CODE_LENGTH = 4;

export function makeInvoiceNumber() {
  const bytes = crypto.randomBytes(INVOICE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < INVOICE_CODE_LENGTH; i += 1) {
    code += INVOICE_ALPHABET[bytes[i] % INVOICE_ALPHABET.length];
  }
  return `R2K${code}`;
}

export function makeVietQrUrl({ bankCode, bankAccount, accountName, amountVnd, invoiceNumber }) {
  const query = [
    `amount=${encodeURIComponent(String(amountVnd))}`,
    `addInfo=${encodeURIComponent(invoiceNumber)}`,
    `accountName=${encodeURIComponent(accountName)}`,
  ].join("&");
  return `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(bankAccount)}-compact2.png?${query}`;
}

export function safeEqualSecret(received, expected) {
  const a = Buffer.from(String(received || ""));
  const b = Buffer.from(String(expected || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isWebhookAuthorizationValid(header, expected) {
  const match = typeof header === "string" ? header.match(/^Apikey\s+(.+)$/i) : null;
  return !!match && safeEqualSecret(match[1].trim(), expected);
}

export function isWebhookHmacValid(signature, timestamp, rawBody, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const match = typeof signature === "string" ? signature.match(/^sha256=([a-f0-9]{64})$/i) : null;
  const timestampNumber = Number(timestamp);
  if (!match || !Number.isSafeInteger(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > 300) return false;
  const expected = crypto.createHmac("sha256", String(secret || "")).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return safeEqualSecret(match[1].toLowerCase(), expected);
}

export function normalizeInvoiceReference(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function webhookTransactionSnapshot(data) {
  return {
    id: data?.id ?? null,
    gateway: data?.gateway || null,
    transactionDate: data?.transactionDate || null,
    accountNumber: data?.accountNumber || null,
    subAccount: data?.subAccount || "",
    code: data?.code || null,
    content: typeof data?.content === "string" ? data.content.trim() : "",
    transferType: data?.transferType || null,
    description: data?.description || "",
    transferAmount: data?.transferAmount ?? null,
    accumulated: data?.accumulated ?? 0,
    referenceCode: data?.referenceCode || null,
  };
}

export function snapshotHasInvoice(snapshot, invoiceNumber) {
  const content = normalizeInvoiceReference(snapshot?.content);
  const invoice = normalizeInvoiceReference(invoiceNumber);
  return !!invoice && content.includes(invoice);
}
