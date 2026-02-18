import sharp from "sharp";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { randomUUID } from "crypto";

const UPLOADS_DIR = join(process.cwd(), "data", "uploads");
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function processAndSaveImage(
  file: File,
  subdir: "recipes" | "cook-logs"
): Promise<{ full: string; thumb: string }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Use JPEG, PNG, or WebP.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("File too large. Max 10MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const dir = join(UPLOADS_DIR, subdir);
  mkdirSync(dir, { recursive: true });

  const fullPath = join(dir, `${id}-full.webp`);
  const thumbPath = join(dir, `${id}-thumb.webp`);

  await sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(fullPath);

  await sharp(buffer)
    .resize(400, 400, { fit: "cover" })
    .webp({ quality: 70 })
    .toFile(thumbPath);

  return {
    full: `/${subdir}/${id}-full.webp`,
    thumb: `/${subdir}/${id}-thumb.webp`,
  };
}

export async function downloadAndSaveImage(
  url: string,
  subdir: "recipes" | "cook-logs"
): Promise<{ full: string; thumb: string }> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_SIZE) {
    throw new Error("Downloaded image too large. Max 10MB.");
  }

  const id = randomUUID();
  const dir = join(UPLOADS_DIR, subdir);
  mkdirSync(dir, { recursive: true });

  const fullPath = join(dir, `${id}-full.webp`);
  const thumbPath = join(dir, `${id}-thumb.webp`);

  await sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(fullPath);

  await sharp(buffer)
    .resize(400, 400, { fit: "cover" })
    .webp({ quality: 70 })
    .toFile(thumbPath);

  return {
    full: `/${subdir}/${id}-full.webp`,
    thumb: `/${subdir}/${id}-thumb.webp`,
  };
}

export function getUploadPath(relativePath: string): string | null {
  // Prevent directory traversal
  const normalized = relativePath.replace(/\.\./g, "").replace(/\/\//g, "/");
  const fullPath = join(UPLOADS_DIR, normalized);
  if (!fullPath.startsWith(UPLOADS_DIR)) return null;
  if (!existsSync(fullPath)) return null;
  return fullPath;
}
