import { TABLES, buildCreateTableSql } from "../schema.js";

const migration = {
  version: 7,
  name: "sepay-topups",
  up(db) {
    db.exec(buildCreateTableSql("paymentTopups", TABLES.paymentTopups));
    for (const index of TABLES.paymentTopups.indexes) db.exec(index);
  },
};

export default migration;
