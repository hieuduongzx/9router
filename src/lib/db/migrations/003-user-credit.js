import { TABLES, buildCreateTableSql } from "../schema.js";

const migration = {
  version: 3,
  name: "user-credit",
  up(db) {
    db.exec(buildCreateTableSql("users", TABLES.users));
    const columns = db.all("PRAGMA table_info(users)");
    if (!columns.some((column) => column.name === "creditCents")) {
      db.exec("ALTER TABLE users ADD COLUMN creditCents INTEGER NOT NULL DEFAULT 0 CHECK (creditCents >= 0)");
    }
  },
};

export default migration;
