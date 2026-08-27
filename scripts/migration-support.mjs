import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CORE_TABLES = [
  "accounts",
  "collections",
  "cook_logs",
  "favorites",
  "recipe_collections",
  "recipe_tags",
  "recipes",
  "sessions",
  "tags",
  "users",
  "verifications",
];

const MANAGED_TABLES = [...CORE_TABLES, "shopping_lists", "recipe_comments", "notifications"];
const CORE_COLUMNS = {
  accounts: [
    "id", "account_id", "provider_id", "user_id", "access_token", "refresh_token", "id_token",
    "access_token_expires_at", "refresh_token_expires_at", "scope", "password", "created_at", "updated_at",
  ],
  collections: ["id", "name", "slug", "description", "image_url", "sort_order", "created_by", "created_at", "updated_at"],
  cook_logs: ["id", "recipe_id", "photo_url", "notes", "rating", "cooked_at", "created_by", "created_at"],
  favorites: ["user_id", "recipe_id", "created_at"],
  recipe_collections: ["recipe_id", "collection_id"],
  recipe_tags: ["recipe_id", "tag_id"],
  recipes: [
    "id", "title", "slug", "description", "ingredients", "cooking_supplies", "steps", "servings",
    "prep_time", "cook_time", "difficulty", "image_url", "image_provider", "image_author_name",
    "image_author_url", "image_source_url", "source_url", "video_url", "notes", "is_published",
    "copied_from", "created_by", "created_at", "updated_at",
  ],
  sessions: ["id", "expires_at", "token", "created_at", "updated_at", "ip_address", "user_agent", "user_id"],
  tags: ["id", "name", "slug"],
  users: [
    "id", "name", "email", "email_verified", "image", "import_prompt", "chat_prompt", "shopping_prompt",
    "cooking_supplies_expanded_by_default", "created_at", "updated_at",
  ],
  verifications: ["id", "identifier", "value", "expires_at", "created_at", "updated_at"],
};
const CORE_INDEXES = [
  "collections_slug_created_by_unique",
  "collections_created_by_idx",
  "collections_created_by_sort_order_idx",
  "cook_logs_recipe_id_idx",
  "cook_logs_created_by_idx",
  "cook_logs_created_by_cooked_at_idx",
  "favorites_user_recipe_unique",
  "favorites_user_created_at_idx",
  "recipe_collections_recipe_collection_unique",
  "recipe_collections_recipe_id_idx",
  "recipe_collections_collection_id_idx",
  "recipe_tags_recipe_tag_unique",
  "recipe_tags_recipe_id_idx",
  "recipe_tags_tag_id_idx",
  "recipes_slug_created_by_unique",
  "recipes_created_by_idx",
  "recipes_is_published_idx",
  "recipes_created_by_published_idx",
  "sessions_token_unique",
  "tags_name_unique",
  "tags_slug_unique",
  "users_email_unique",
];
const API_TOKEN_COLUMNS = [
  "api_token_hash",
  "api_token_preview",
  "api_token_created_at",
  "api_token_last_used_at",
];

function tableNames(db) {
  return new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name),
  );
}

function indexNames(db) {
  return new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name),
  );
}

function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(\"${table}\")`).all().map((row) => row.name));
}

function hasAll(set, values) {
  return values.every((value) => set.has(value));
}

export function readMigrationEntries(rootDir) {
  const journalPath = join(rootDir, "drizzle", "meta", "_journal.json");
  if (!existsSync(journalPath)) {
    throw new Error(`Cannot find migration journal at ${journalPath}`);
  }

  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const entries = Array.isArray(journal.entries) ? journal.entries : [];
  if (entries.length === 0) {
    throw new Error("Migration journal has no entries.");
  }
  return entries;
}

export function migrationRecordCount(db) {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
    .get();
  if (!table) return 0;
  return Number(db.prepare('SELECT COUNT(*) AS count FROM "__drizzle_migrations"').get().count);
}

/**
 * Detect the contiguous migrations already represented by a legacy database.
 * Later migrations remain for Drizzle to apply normally.
 */
export function legacyBaselineCount(db) {
  const tables = tableNames(db);
  const indexes = indexNames(db);
  const hasManagedSchema = MANAGED_TABLES.some((table) => tables.has(table));
  if (!hasManagedSchema) return 0;

  const coreReady = hasAll(tables, CORE_TABLES)
    && Object.entries(CORE_COLUMNS).every(([table, columns]) => hasAll(columnNames(db, table), columns))
    && hasAll(indexes, CORE_INDEXES);
  if (!coreReady) {
    throw new Error("Legacy database has a partial core schema; refusing to guess its migration state.");
  }

  let count = 1;
  const usersColumns = columnNames(db, "users");
  if (!usersColumns.has("dirk_secret_mode_enabled")) {
    if (tables.has("shopping_lists") || API_TOKEN_COLUMNS.some((column) => usersColumns.has(column))) {
      throw new Error("Legacy database migrations are not a contiguous prefix.");
    }
    return count;
  }
  count = 2;

  if (!tables.has("shopping_lists")) {
    if (API_TOKEN_COLUMNS.some((column) => usersColumns.has(column))) {
      throw new Error("Legacy database migrations are not a contiguous prefix.");
    }
    return count;
  }
  const shoppingColumns = columnNames(db, "shopping_lists");
  if (!hasAll(shoppingColumns, ["user_id", "items", "organized", "organized_for", "checked", "created_at", "updated_at"])) {
    throw new Error("Legacy shopping_lists table is incomplete.");
  }
  count = 3;

  const presentApiTokenColumns = API_TOKEN_COLUMNS.filter((column) => usersColumns.has(column));
  if (presentApiTokenColumns.length === 0) return count;
  if (presentApiTokenColumns.length !== API_TOKEN_COLUMNS.length || !indexes.has("users_api_token_hash_unique")) {
    throw new Error("Legacy API-token schema is incomplete.");
  }
  count = 4;

  const commentsReady = tables.has("recipe_comments")
    && hasAll(columnNames(db, "recipe_comments"), ["id", "recipe_id", "author_id", "body", "reaction", "created_at"]);
  const notificationsReady = tables.has("notifications")
    && hasAll(columnNames(db, "notifications"), [
      "id",
      "recipient_id",
      "actor_id",
      "recipe_id",
      "comment_id",
      "type",
      "read_at",
      "created_at",
    ]);
  if ((tables.has("recipe_comments") && !commentsReady) || (tables.has("notifications") && !notificationsReady)) {
    throw new Error("Legacy comments or notifications schema is incomplete.");
  }

  const commentsIndexesReady = hasAll(indexes, [
    "recipe_comments_recipe_id_created_at_idx",
    "recipe_comments_author_id_idx",
    "notifications_recipient_created_at_idx",
    "notifications_recipient_read_at_idx",
    "notifications_comment_id_idx",
  ]);
  if (commentsReady && notificationsReady && commentsIndexesReady) count = 5;

  return count;
}

export function stampLegacyMigrations(db, rootDir, count) {
  const entries = readMigrationEntries(rootDir);
  if (count < 1 || count > entries.length) {
    throw new Error(`Invalid legacy baseline count: ${count}`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);

  const insert = db.prepare(
    'INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)',
  );
  const transaction = db.transaction(() => {
    for (const entry of entries.slice(0, count)) {
      const sqlPath = join(rootDir, "drizzle", `${entry.tag}.sql`);
      if (!existsSync(sqlPath)) throw new Error(`Missing migration SQL file: ${sqlPath}`);
      const sql = readFileSync(sqlPath);
      insert.run(createHash("sha256").update(sql).digest("hex"), entry.when);
    }
  });
  transaction();
  return count;
}
