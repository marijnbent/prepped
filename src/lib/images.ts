import sharp from "sharp";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { assertPublicHttpUrl } from "./url-safety";

const UPLOADS_DIR = join(process.cwd(), "data", "uploads");
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_DOWNLOAD_TIMEOUT_MS = 20_000;

function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = IMAGE_DOWNLOAD_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}

function ensureValidImageType(type: string) {
  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error("Invalid file type. Use JPEG, PNG, or WebP.");
  }
}

function ensureValidImageSize(size: number) {
  if (size > MAX_SIZE) {
    throw new Error("File too large. Max 10MB.");
  }
}

async function saveProcessedBuffers(
  buffer: Buffer,
  subdir: "recipes" | "cook-logs"
): Promise<{ full: string; thumb: string }> {
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

export async function processAndSaveImageBuffer(
  buffer: Buffer,
  type: string,
  subdir: "recipes" | "cook-logs"
): Promise<{ full: string; thumb: string }> {
  ensureValidImageType(type);
  ensureValidImageSize(buffer.length);
  return saveProcessedBuffers(buffer, subdir);
}

export async function processAndSaveImage(
  file: File,
  subdir: "recipes" | "cook-logs"
): Promise<{ full: string; thumb: string }> {
  ensureValidImageType(file.type);
  ensureValidImageSize(file.size);
  const buffer = Buffer.from(await file.arrayBuffer());
  return saveProcessedBuffers(buffer, subdir);
}

export async function downloadAndSaveImage(
  url: string,
  subdir: "recipes" | "cook-logs"
): Promise<{ full: string; thumb: string }> {
  const safeUrl = (await assertPublicHttpUrl(url)).toString();
  const response = await fetchWithTimeout(safeUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  ensureValidImageSize(buffer.length);
  return saveProcessedBuffers(buffer, subdir);
}

export function getUploadPath(relativePath: string): string | null {
  // Prevent directory traversal
  const normalized = relativePath.replace(/\.\./g, "").replace(/\/\//g, "/");
  const fullPath = join(UPLOADS_DIR, normalized);
  if (!fullPath.startsWith(UPLOADS_DIR)) return null;
  if (!existsSync(fullPath)) return null;
  return fullPath;
}
