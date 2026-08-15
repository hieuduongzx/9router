import { TABLES, buildCreateTableSql } from "../schema.js";

const migration = {
  version: 6,
  name: "external-identities",
  up(db) {
    db.exec(buildCreateTableSql("externalIdentities", TABLES.externalIdentities));
    for (const index of TABLES.externalIdentities.indexes) db.exec(index);
  },
};

export default migration;
