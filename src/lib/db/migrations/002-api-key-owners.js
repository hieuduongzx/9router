import { TABLES, buildCreateTableSql } from "../schema.js";

const migration = {
  version: 2,
  name: "api-key-owners",
  up(db) {
    // Schema v1 predates account tables in some installations. Create the
    // referenced table before adding/backfilling apiKeys.ownerUserId.
    db.exec(buildCreateTableSql("users", TABLES.users));
    for (const index of TABLES.users.indexes || []) db.exec(index);

    const columns = db.all("PRAGMA table_info(apiKeys)");
    if (!columns.some((column) => column.name === "ownerUserId")) {
      db.exec("ALTER TABLE apiKeys ADD COLUMN ownerUserId TEXT REFERENCES users(id) ON DELETE CASCADE");
    }

    const admin = db.get("SELECT id FROM users WHERE role = 'admin' AND isActive = 1 ORDER BY createdAt ASC LIMIT 1");
    if (admin?.id) {
      db.run("UPDATE apiKeys SET ownerUserId = ? WHERE ownerUserId IS NULL", [admin.id]);
    }

    db.exec("CREATE INDEX IF NOT EXISTS idx_ak_owner ON apiKeys(ownerUserId, createdAt)");
  },
};

export default migration;
