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

export const db = drizzle(sqlite, { schema });

// Seed default tags on first run (collections are seeded per-user on signup)
const shouldSeed = import.meta.env.SEED_DEFAULTS || process.env.SEED_DEFAULTS;
if (shouldSeed === "true" || shouldSeed === "1") {
  import("./seed").then(({ seedDefaults }) => seedDefaults());
}
