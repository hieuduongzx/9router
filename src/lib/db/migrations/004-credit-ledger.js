export default {
  version: 4,
  name: "credit-ledger",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS creditLedger (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amountCents INTEGER NOT NULL,
        balanceAfterCents INTEGER NOT NULL CHECK (balanceAfterCents >= 0),
        type TEXT NOT NULL,
        source TEXT,
        note TEXT,
        actorUserId TEXT,
        meta TEXT,
        createdAt TEXT NOT NULL
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON creditLedger(userId, createdAt DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_credit_ledger_created ON creditLedger(createdAt DESC)`);
  },
};
