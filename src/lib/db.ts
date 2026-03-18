import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import { join } from "path";
import { mkdirSync } from "fs";

const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(join(dataDir, "prepped.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

type TableInfoRow = { name: string };

function ensureRecipesColumns() {
  const columns = sqlite.prepare("PRAGMA table_info(recipes)").all() as TableInfoRow[];
  if (columns.length === 0) return;

  const existing = new Set(columns.map((column) => column.name));
  const missingColumns = [
    ["image_provider", "TEXT"],
    ["image_author_name", "TEXT"],
    ["image_author_url", "TEXT"],
    ["image_source_url", "TEXT"],
    ["cooking_supplies", "TEXT"],
  ].filter(([name]) => !existing.has(name));

  for (const [name, type] of missingColumns) {
    sqlite.exec(`ALTER TABLE recipes ADD COLUMN ${name} ${type}`);
  }
}

function ensureUsersColumns() {
  const columns = sqlite.prepare("PRAGMA table_info(users)").all() as TableInfoRow[];
  if (columns.length === 0) return;

  const existing = new Set(columns.map((column) => column.name));
  const missingColumns = [
    ["cooking_supplies_expanded_by_default", "INTEGER NOT NULL DEFAULT 0"],
    ["dirk_secret_mode_enabled", "INTEGER NOT NULL DEFAULT 0"],
    ["api_token_hash", "TEXT"],
    ["api_token_preview", "TEXT"],
    ["api_token_created_at", "INTEGER"],
    ["api_token_last_used_at", "INTEGER"],
  ].filter(([name]) => !existing.has(name));

  for (const [name, type] of missingColumns) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
  }

  sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_api_token_hash_unique ON users(api_token_hash)");
}

function ensureShoppingListsTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS shopping_lists (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      items TEXT NOT NULL DEFAULT '[]',
      organized TEXT,
      organized_for TEXT,
      checked TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

ensureRecipesColumns();
ensureUsersColumns();
ensureShoppingListsTable();

export const db = drizzle(sqlite, { schema });

// Seed default tags on first run (collections are seeded per-user on signup)
const shouldSeed = import.meta.env.SEED_DEFAULTS || process.env.SEED_DEFAULTS;
if (shouldSeed === "true" || shouldSeed === "1") {
  import("./seed").then(({ seedDefaults }) => seedDefaults());
}
