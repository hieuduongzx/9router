import { randomUUID } from "node:crypto";
import { getAdapter } from "../driver.js";
import { stringifyJson } from "../helpers/jsonCol.js";
import { insertCreditLedgerEntry } from "./creditLedgerRepo.js";

export const TOPUP_STATUS = Object.freeze({ PENDING: "pending", PAID: "paid", FAILED: "failed", CANCELLED: "cancelled" });
const MAX_CREDIT_CENTS = 100_000_000;
const PENDING_RESERVATION_MS = 24 * 60 * 60 * 1000;

function rowToTopup(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    invoiceNumber: row.invoiceNumber,
    sepayOrderId: row.sepayOrderId || null,
    sepayTransactionId: row.sepayTransactionId || null,
    amountVnd: Number(row.amountVnd),
    creditCents: Number(row.creditCents),
    status: row.status,
    paymentMethod: row.paymentMethod || null,
    createdAt: row.createdAt,
    paidAt: row.paidAt || null,
  };
}

export async function createTopup({ userId, amountVnd, creditCents, invoiceNumber }) {
  if (!userId || !Number.isSafeInteger(amountVnd) || amountVnd <= 0) throw new Error("Invalid top-up amount");
  if (!Number.isSafeInteger(creditCents) || creditCents <= 0) throw new Error("Invalid top-up credit");
  if (!invoiceNumber) throw new Error("Invoice number is required");
  const db = await getAdapter();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  let topup = null;
  db.transaction(() => {
    const user = db.get("SELECT creditCents FROM users WHERE id = ?", [userId]);
    if (!user) throw new Error("Account not found");
    const reservationCutoff = new Date(Date.now() - PENDING_RESERVATION_MS).toISOString();
    const pendingCents = Number(db.get("SELECT COALESCE(SUM(creditCents), 0) AS total FROM paymentTopups WHERE userId = ? AND status = ? AND createdAt >= ?", [userId, TOPUP_STATUS.PENDING, reservationCutoff])?.total) || 0;
    if (Number(user.creditCents) + pendingCents + creditCents > MAX_CREDIT_CENTS) {
      throw new Error("Top-up would exceed the $1,000,000.00 wallet limit");
    }
    db.run(
      `INSERT INTO paymentTopups(id, userId, invoiceNumber, amountVnd, creditCents, status, createdAt)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, invoiceNumber, amountVnd, creditCents, TOPUP_STATUS.PENDING, createdAt],
    );
    topup = rowToTopup(db.get("SELECT * FROM paymentTopups WHERE id = ?", [id]));
  });
  return topup;
}

export async function getTopupByInvoice(invoiceNumber) {
  const db = await getAdapter();
  return rowToTopup(db.get("SELECT * FROM paymentTopups WHERE invoiceNumber = ?", [invoiceNumber]));
}

export async function listTopups(userId, { limit = 20 } = {}) {
  if (!userId) return [];
  const db = await getAdapter();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  return db.all("SELECT * FROM paymentTopups WHERE userId = ? ORDER BY createdAt DESC LIMIT ?", [userId, safeLimit]).map(rowToTopup);
}

export async function getTopupByWebhookContent(content) {
  const normalizedContent = String(content || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalizedContent) return null;
  const db = await getAdapter();
  const rows = db.all("SELECT * FROM paymentTopups WHERE status = ? ORDER BY createdAt ASC", [TOPUP_STATUS.PENDING]);
  const row = rows.find((candidate) => normalizedContent.includes(String(candidate.invoiceNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "")));
  return rowToTopup(row);
}

/**
 * Marks one SePay order paid and credits the account exactly once. The invoice
 * row is locked by the SQLite transaction; replayed IPNs see the paid status.
 */
export async function settleTopup({ invoiceNumber, sepayOrderId, sepayTransactionId, amountVnd, paymentMethod, rawData }) {
  if (!invoiceNumber || !Number.isSafeInteger(amountVnd) || amountVnd <= 0) return { ok: false, code: "invalid_payment" };
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get("SELECT * FROM paymentTopups WHERE invoiceNumber = ?", [invoiceNumber]);
    if (!row) { result = { ok: false, code: "topup_not_found" }; return; }
    if (row.status === TOPUP_STATUS.PAID) {
      const samePayment = Number(row.amountVnd) === amountVnd
        && (!row.sepayOrderId || row.sepayOrderId === sepayOrderId)
        && (!row.sepayTransactionId || row.sepayTransactionId === sepayTransactionId);
      result = samePayment
        ? { ok: true, duplicate: true, topup: rowToTopup(row) }
        : { ok: false, code: "payment_reused" };
      return;
    }
    if (row.status !== TOPUP_STATUS.PENDING) { result = { ok: false, code: "topup_not_pending" }; return; }
    if (Number(row.amountVnd) !== amountVnd) { result = { ok: false, code: "amount_mismatch" }; return; }
    const duplicate = sepayTransactionId
      ? db.get("SELECT id FROM paymentTopups WHERE sepayTransactionId = ? AND invoiceNumber != ?", [sepayTransactionId, invoiceNumber])
      : null;
    const duplicateOrder = sepayOrderId
      ? db.get("SELECT id FROM paymentTopups WHERE sepayOrderId = ? AND invoiceNumber != ?", [sepayOrderId, invoiceNumber])
      : null;
    if (duplicate || duplicateOrder) { result = { ok: false, code: "payment_reused" }; return; }

    const credited = db.get("SELECT * FROM users WHERE id = ?", [row.userId]);
    if (!credited) { result = { ok: false, code: "user_not_found" }; return; }
    const nextCreditCents = Number(credited.creditCents) + Number(row.creditCents);
    const paidAt = new Date().toISOString();
    db.run(
      `UPDATE paymentTopups SET sepayOrderId = ?, sepayTransactionId = ?, status = ?, paymentMethod = ?, rawData = ?, paidAt = ? WHERE id = ? AND status = ?`,
      [sepayOrderId || null, sepayTransactionId || null, TOPUP_STATUS.PAID, paymentMethod || null, stringifyJson(rawData || {}), paidAt, row.id, TOPUP_STATUS.PENDING],
    );
    db.run("UPDATE users SET creditCents = ?, updatedAt = ? WHERE id = ?", [nextCreditCents, paidAt, row.userId]);
    insertCreditLedgerEntry(db, {
      userId: row.userId,
      amountCents: Number(row.creditCents),
      balanceAfterCents: nextCreditCents,
      type: "topup",
      source: "sepay",
      note: `SePay top-up ${row.invoiceNumber}`,
      meta: { invoiceNumber: row.invoiceNumber, sepayOrderId: sepayOrderId || null, sepayTransactionId: sepayTransactionId || null },
      createdAt: paidAt,
    });
    result = { ok: true, duplicate: false, topup: rowToTopup(db.get("SELECT * FROM paymentTopups WHERE id = ?", [row.id])), creditCents: nextCreditCents };
  });
  return result;
}

export const __test__ = { rowToTopup };
