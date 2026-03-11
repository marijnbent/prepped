import Database from "better-sqlite3";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const rootDir = process.cwd();
const dataDir = resolve(rootDir, process.env.DATA_DIR || "data");
const sourcePath = resolve(dataDir, process.env.DB_PATH || "prepped.db");
const backupDir = resolve(rootDir, process.env.BACKUP_DIR || join("data", "backups"));
const retentionDays = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || "14", 10);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function pruneOldBackups() {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) return;

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(backupDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".db"))
      .map(async (entry) => {
        const fullPath = join(backupDir, entry.name);
        const stats = await stat(fullPath);
        if (stats.mtimeMs < cutoff) {
          await rm(fullPath, { force: true });
        }
      }),
  );
}

async function main() {
  await mkdir(backupDir, { recursive: true });

  const filename = `${basename(sourcePath, ".db")}-${timestamp()}.db`;
  const destinationPath = join(backupDir, filename);

  const db = new Database(sourcePath, { readonly: true });

  try {
    await db.backup(destinationPath);
    await pruneOldBackups();
    console.log(`Created SQLite backup: ${destinationPath}`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error("Backup failed.");
  console.error(error);
  process.exit(1);
});
