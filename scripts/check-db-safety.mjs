import Database from "better-sqlite3";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const dbPath = process.env.DB_PATH || join(process.cwd(), "data", "prepped.db");
const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), "data", "uploads");
const recipeUploadsDir = join(uploadsDir, "recipes");

if (!existsSync(dbPath)) {
  console.log(`DB preflight: no database found at ${dbPath}, treating this as a fresh install.`);
  process.exit(0);
}

function countFiles(dirPath) {
  if (!existsSync(dirPath)) return 0;

  let total = 0;
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      total += countFiles(fullPath);
    } else if (stat.isFile()) {
      total += 1;
    }
  }
  return total;
}

function getCount(db, tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}

const db = new Database(dbPath, { readonly: true, fileMustExist: true });

try {
  const tables = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
  );

  const requiredTables = ["users", "recipes", "collections", "tags"];
  const missingTables = requiredTables.filter((name) => !tables.has(name));
  if (missingTables.length > 0) {
    console.error(`DB preflight failed: missing required tables: ${missingTables.join(", ")}`);
    process.exit(1);
  }

  const users = getCount(db, "users");
  const recipes = getCount(db, "recipes");
  const collections = getCount(db, "collections");
  const recipeCollections = tables.has("recipe_collections") ? getCount(db, "recipe_collections") : 0;
  const cookLogs = tables.has("cook_logs") ? getCount(db, "cook_logs") : 0;
  const recipeTags = tables.has("recipe_tags") ? getCount(db, "recipe_tags") : 0;
  const recipeUploadFiles = countFiles(recipeUploadsDir);

  const looksLikeDroppedRecipeData =
    users > 0 &&
    recipes === 0 &&
    (
      recipeUploadFiles > 0 ||
      recipeCollections > 0 ||
      recipeTags > 0 ||
      cookLogs > 0
    );

  if (looksLikeDroppedRecipeData) {
    console.error("DB preflight failed: suspicious recipe wipe detected.");
    console.error(`users=${users} recipes=${recipes} collections=${collections} recipe_collections=${recipeCollections} recipe_tags=${recipeTags} cook_logs=${cookLogs} recipe_upload_files=${recipeUploadFiles}`);
    console.error("Refusing to start because recipe data appears to be missing while related data still exists.");
    process.exit(1);
  }

  console.log(`DB preflight OK: users=${users} recipes=${recipes} collections=${collections} recipe_upload_files=${recipeUploadFiles}`);
} finally {
  db.close();
}
