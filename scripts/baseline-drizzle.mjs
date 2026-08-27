import Database from "better-sqlite3";
import { existsSync } from "fs";
import { join } from "path";
import {
  legacyBaselineCount,
  migrationRecordCount,
  readMigrationEntries,
  stampLegacyMigrations,
} from "./migration-support.mjs";

const rootDir = process.cwd();
const dbPath = process.env.DB_PATH || join(rootDir, "data", "prepped.db");
if (!existsSync(dbPath)) {
  console.error(`Cannot baseline migrations: database not found at ${dbPath}`);
  process.exit(1);
}

const entries = readMigrationEntries(rootDir);

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

try {
  const existingCount = migrationRecordCount(db);
  if (existingCount > 0) {
    console.log(`Drizzle baseline skipped: ${existingCount} migration record(s) already present.`);
    process.exit(0);
  }

  const count = legacyBaselineCount(db);
  if (count === 0) {
    console.error("Cannot baseline migrations: database has no complete legacy schema.");
    process.exit(1);
  }

  stampLegacyMigrations(db, rootDir, count);
  console.log(`Drizzle baseline complete: stamped ${count} migration(s) in ${dbPath}`);
  if (count < entries.length) {
    console.log(`Run npm run db:migrate to apply ${entries.length - count} remaining migration(s).`);
  }
} finally {
  db.close();
}
