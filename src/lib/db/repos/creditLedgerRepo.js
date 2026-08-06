import { randomUUID } from "node:crypto";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function rowToEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    amountCents: Number(row.amountCents) || 0,
    balanceAfterCents: Number(row.balanceAfterCents) || 0,
    type: row.type || "adjustment",
    source: row.source || null,
    note: row.note || null,
    actorUserId: row.actorUserId || null,
    meta: parseJson(row.meta, null),
    createdAt: row.createdAt,
  };
}

export function insertCreditLedgerEntry(db, {
  userId,
  amountCents,
  balanceAfterCents,
  type = "adjustment",
  source = null,
  note = null,
  actorUserId = null,
  meta = null,
  createdAt = new Date().toISOString(),
}) {
  if (!userId) throw new Error("userId is required for credit ledger entry.");
  if (!Number.isSafeInteger(amountCents) || amountCents === 0) {
    throw new Error("amountCents must be a non-zero integer.");
  }
  if (!Number.isSafeInteger(balanceAfterCents) || balanceAfterCents < 0) {
    throw new Error("balanceAfterCents must be a non-negative integer.");
  }

  const id = randomUUID();
  db.run(
    `INSERT INTO creditLedger(
      id, userId, amountCents, balanceAfterCents, type, source, note, actorUserId, meta, createdAt
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      amountCents,
      balanceAfterCents,
      type,
      source,
      note,
      actorUserId,
      meta == null ? null : stringifyJson(meta),
      createdAt,
    ],
  );
  return rowToEntry({
    id,
    userId,
    amountCents,
    balanceAfterCents,
    type,
    source,
    note,
    actorUserId,
    meta: meta == null ? null : stringifyJson(meta),
    createdAt,
  });
}

/**
 * Wallet history. `includeUsage` controls whether per-request spend lines are
 * returned alongside top-ups and admin adjustments — they are the reason a
 * balance moves, so they are included by default; pass false for a top-ups-only
 * view.
 */
export async function listCreditLedger(userId, { limit = 50, offset = 0, includeUsage = true } = {}) {
  if (!userId) return { entries: [], total: 0 };
  const db = await getAdapter();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const usageFilter = includeUsage
    ? ""
    : ` AND type != 'usage' AND IFNULL(source, '') != 'api_usage'`;
  const total = db.get(
    `SELECT COUNT(*) AS count FROM creditLedger
     WHERE userId = ?${usageFilter}`,
    [userId],
  )?.count || 0;
  const rows = db.all(
    `SELECT * FROM creditLedger
     WHERE userId = ?${usageFilter}
     ORDER BY createdAt DESC, rowid DESC
     LIMIT ? OFFSET ?`,
    [userId, safeLimit, safeOffset],
  );
  return {
    entries: rows.map(rowToEntry),
    total: Number(total) || 0,
    limit: safeLimit,
    offset: safeOffset,
  };
}
