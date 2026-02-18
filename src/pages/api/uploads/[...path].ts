import type { APIRoute } from "astro";
import { getUploadPath } from "../../../lib/images";
import { readFile } from "fs/promises";

export const GET: APIRoute = async ({ params }) => {
  const relativePath = params.path;
  if (!relativePath) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = getUploadPath(relativePath);
  if (!filePath) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await readFile(filePath);
  const contentType = filePath.endsWith(".webp")
    ? "image/webp"
    : filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")
      ? "image/jpeg"
      : "image/png";

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
