import sharp from "sharp";
import { isAbsolute, join, relative, resolve, sep } from "path";
import { mkdirSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { fetchPublicHttpUrl } from "./url-safety";

const UPLOADS_DIR = join(process.cwd(), "data", "uploads");
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_INPUT_PIXELS = 40_000_000;

function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = IMAGE_DOWNLOAD_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetchPublicHttpUrl(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}

function ensureValidImageType(type: string) {
  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error("Invalid file type. Use JPEG, PNG, or WebP.");
  }
}

export function ensureValidImageSize(size: number) {
  if (size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("File too large. Max 10MB.");
  }
}

export function decodeBase64Image(payload: string): Buffer {
  const estimatedBytes = Math.ceil(payload.length * 0.75);
  ensureValidImageSize(estimatedBytes);
  const buffer = Buffer.from(payload, "base64");
  ensureValidImageSize(buffer.length);
  return buffer;
}

async function readResponseBufferWithLimit(response: Response): Promise<Buffer> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength)) ensureValidImageSize(contentLength);

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    ensureValidImageSize(buffer.length);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_SIZE_BYTES) {
      await reader.cancel();
      ensureValidImageSize(size);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
}

async function ensureValidImageBuffer(buffer: Buffer) {
  const metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new Error("Invalid image data. Use JPEG, PNG, or WebP.");
  }
}

async function saveProcessedBuffers(
  buffer: Buffer,
  subdir: "recipes" | "cook-logs"
): Promise<{ full: string; thumb: string }> {
  await ensureValidImageBuffer(buffer);
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
  const response = await fetchWithTimeout(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = await readResponseBufferWithLimit(response);
  return saveProcessedBuffers(buffer, subdir);
}

export function getUploadPath(relativePath: string): string | null {
  const fullPath = resolve(UPLOADS_DIR, relativePath);
  const fromUploads = relative(UPLOADS_DIR, fullPath);
  if (!fromUploads || fromUploads === ".." || fromUploads.startsWith(`..${sep}`) || isAbsolute(fromUploads)) return null;
  if (!existsSync(fullPath)) return null;
  return fullPath;
}
