import Database from "better-sqlite3";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const rootDir = process.cwd();
const dbPath = process.env.DB_PATH || join(rootDir, "data", "prepped.db");
const journalPath = join(rootDir, "drizzle", "meta", "_journal.json");

if (!existsSync(dbPath)) {
  console.error(`Cannot baseline migrations: database not found at ${dbPath}`);
  process.exit(1);
}

if (!existsSync(journalPath)) {
  console.error(`Cannot baseline migrations: journal not found at ${journalPath}`);
  process.exit(1);
}

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const entries = Array.isArray(journal.entries) ? journal.entries : [];

if (entries.length === 0) {
  console.error("Cannot baseline migrations: drizzle/meta/_journal.json has no entries.");
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

try {
  const tables = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
  );

  const requiredTables = ["users", "recipes", "collections", "tags"];
  const missingTables = requiredTables.filter((name) => !tables.has(name));
  if (missingTables.length > 0) {
    console.error(`Cannot baseline migrations: missing required tables: ${missingTables.join(", ")}`);
    process.exit(1);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);

  const existingRows = db
    .prepare('SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY created_at ASC')
    .all();

  if (existingRows.length > 0) {
    console.log(`Drizzle baseline skipped: ${existingRows.length} migration record(s) already present.`);
    process.exit(0);
  }

  const insertMigration = db.prepare('INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const entry of entries) {
      const sqlPath = join(rootDir, "drizzle", `${entry.tag}.sql`);
      if (!existsSync(sqlPath)) {
        throw new Error(`Missing migration SQL file: ${sqlPath}`);
      }

      const hash = createHash("sha256").update(readFileSync(sqlPath)).digest("hex");
      insertMigration.run(hash, entry.when);
    }
  });

  tx();
  console.log(`Drizzle baseline complete: stamped ${entries.length} migration(s) in ${dbPath}`);
} finally {
  db.close();
}
