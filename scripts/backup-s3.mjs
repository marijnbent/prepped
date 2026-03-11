import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import Database from "better-sqlite3";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

const rootDir = process.cwd();
const dataDir = resolve(rootDir, process.env.DATA_DIR || "data");
const sourcePath = resolve(dataDir, process.env.DB_PATH || "prepped.db");
const uploadsDir = resolve(rootDir, process.env.UPLOADS_DIR || join("data", "uploads"));

const bucket = process.env.SCW_BUCKET || "bentbackup";
const region = process.env.SCW_REGION || "fr-par";
const endpoint = process.env.SCW_ENDPOINT || `https://s3.${region}.scw.cloud`;
const backupPrefix = (process.env.S3_BACKUP_PREFIX || "recepten.bentjes.nl").replace(/^\/+|\/+$/g, "");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function currentBackupPath() {
  return new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
}

function toPosixPath(path) {
  return path.split("\\").join("/");
}

function getContentType(path) {
  const extension = extname(path).toLowerCase();

  switch (extension) {
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".db":
      return "application/x-sqlite3";
    default:
      return "application/octet-stream";
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function uploadFile(client, localPath, key) {
  const body = await readFile(localPath);

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: getContentType(localPath),
  }));
}

async function objectExists(client, key) {
  try {
    await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return true;
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "$metadata" in error && error.$metadata && typeof error.$metadata === "object"
        ? error.$metadata.httpStatusCode
        : undefined;

    if (statusCode === 404) {
      return false;
    }

    throw error;
  }
}

async function createDatabaseSnapshot(tempDir) {
  const filename = `${basename(sourcePath, ".db")}-${timestamp()}.db`;
  const backupPath = join(tempDir, filename);
  const db = new Database(sourcePath, { readonly: true });

  try {
    await db.backup(backupPath);
    return { backupPath, filename };
  } finally {
    db.close();
  }
}

async function uploadImages(client) {
  const files = await collectFiles(uploadsDir).catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  });

  let uploadedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const relativePath = toPosixPath(relative(uploadsDir, file));
    const key = `${backupPrefix}/images/${relativePath}`;

    if (await objectExists(client, key)) {
      skippedCount += 1;
      continue;
    }

    await uploadFile(client, file, key);
    uploadedCount += 1;
  }

  return { totalCount: files.length, uploadedCount, skippedCount };
}

async function main() {
  const client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: requireEnv("SCW_ACCESS_KEY"),
      secretAccessKey: requireEnv("SCW_SECRET_KEY"),
    },
  });

  const tempDir = await mkdtemp(join(tmpdir(), "prepped-s3-backup-"));

  try {
    const backupRunPath = currentBackupPath();
    const { backupPath, filename } = await createDatabaseSnapshot(tempDir);
    const databaseKey = `${backupPrefix}/${backupRunPath}/${filename}`;

    await uploadFile(client, backupPath, databaseKey);
    const uploadedImages = await uploadImages(client);

    console.log(`Uploaded database backup to s3://${bucket}/${databaseKey}`);
    console.log(
      `Images synced to s3://${bucket}/${backupPrefix}/images/ (${uploadedImages.uploadedCount} uploaded, ${uploadedImages.skippedCount} skipped, ${uploadedImages.totalCount} total)`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("S3 backup failed.");
  console.error(error);
  process.exit(1);
});
