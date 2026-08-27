import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  legacyBaselineCount,
  migrationRecordCount,
  stampLegacyMigrations,
} from "./migration-support.mjs";

const rootDir = process.cwd();
const dbPath = join(rootDir, "data", "prepped.db");
const migrationsFolder = join(rootDir, "drizzle");
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

try {
  if (migrationRecordCount(sqlite) === 0) {
    const count = legacyBaselineCount(sqlite);
    if (count > 0) {
      stampLegacyMigrations(sqlite, rootDir, count);
      console.log(`Detected legacy schema and recorded ${count} existing migration(s).`);
    }
  }

  migrate(drizzle(sqlite), { migrationsFolder });
  console.log("Database migrations are current.");
} finally {
  sqlite.close();
}
