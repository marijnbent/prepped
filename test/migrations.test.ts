import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  legacyBaselineCount,
  migrationRecordCount,
  stampLegacyMigrations,
} from "../scripts/migration-support.mjs";

function withTemporaryDatabase(run: (sqlite: Database.Database, directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), "prepped-migrations-"));
  const sqlite = new Database(join(directory, "prepped.db"));

  try {
    sqlite.pragma("foreign_keys = ON");
    run(sqlite, directory);
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test("reviewed migrations create the complete schema", () => {
  withTemporaryDatabase((sqlite) => {
    migrate(drizzle(sqlite), { migrationsFolder: resolve("drizzle") });

    const tables = new Set(
      (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>)
        .map((row) => row.name),
    );
    for (const table of ["recipes", "shopping_lists", "recipe_comments", "notifications"]) {
      assert.ok(tables.has(table), `missing table: ${table}`);
    }
  });
});

test("records a complete legacy schema without replaying migrations", () => {
  withTemporaryDatabase((sqlite) => {
    migrate(drizzle(sqlite), { migrationsFolder: resolve("drizzle") });
    sqlite.exec('DROP TABLE "__drizzle_migrations"');

    const count = legacyBaselineCount(sqlite);
    assert.equal(count, 5);
    stampLegacyMigrations(sqlite, resolve("."), count);
    assert.equal(migrationRecordCount(sqlite), 5);
  });
});

test("leaves an absent idempotent migration for Drizzle to apply", () => {
  withTemporaryDatabase((sqlite) => {
    migrate(drizzle(sqlite), { migrationsFolder: resolve("drizzle") });
    sqlite.exec('DROP TABLE "notifications"; DROP TABLE "__drizzle_migrations"');

    const count = legacyBaselineCount(sqlite);
    assert.equal(count, 4);
    stampLegacyMigrations(sqlite, resolve("."), count);
    migrate(drizzle(sqlite), { migrationsFolder: resolve("drizzle") });

    const notificationTable = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notifications'")
      .get();
    assert.ok(notificationTable);
    assert.equal(migrationRecordCount(sqlite), 5);
  });
});

test("refuses to baseline an incomplete core schema", () => {
  withTemporaryDatabase((sqlite) => {
    migrate(drizzle(sqlite), { migrationsFolder: resolve("drizzle") });
    sqlite.exec('DROP INDEX "recipes_slug_created_by_unique"; DROP TABLE "__drizzle_migrations"');

    assert.throws(
      () => legacyBaselineCount(sqlite),
      /partial core schema/,
    );
  });
});
