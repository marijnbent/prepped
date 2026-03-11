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
  ].filter(([name]) => !existing.has(name));

  for (const [name, type] of missingColumns) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
  }
}

ensureRecipesColumns();
ensureUsersColumns();

export const db = drizzle(sqlite, { schema });

// Seed default tags on first run (collections are seeded per-user on signup)
const shouldSeed = import.meta.env.SEED_DEFAULTS || process.env.SEED_DEFAULTS;
if (shouldSeed === "true" || shouldSeed === "1") {
  import("./seed").then(({ seedDefaults }) => seedDefaults());
}
