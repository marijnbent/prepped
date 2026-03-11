export type ImageProvider = "upload" | "unsplash";

export function normalizeImageProvider(value: unknown): ImageProvider | undefined {
  return value === "upload" || value === "unsplash" ? value : undefined;
}
