import type { APIRoute } from "astro";
import { processAndSaveImage, processAndSaveImageBuffer } from "../../../lib/images";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  let subdir: "recipes" | "cook-logs" = "recipes";

  let file: File | null = null;
  let buffer: Buffer | null = null;
  let mimeType: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as {
      image?: unknown;
      subdir?: unknown;
      mimeType?: unknown;
    } | null;

    if (body?.subdir === "recipes" || body?.subdir === "cook-logs") {
      subdir = body.subdir;
    }

    const image = typeof body?.image === "string" ? body.image : "";
    if (!image) {
      return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
    }

    const dataUrlMatch = image.match(/^data:([^;]+);base64,(.+)$/);
    const base64Payload = dataUrlMatch ? dataUrlMatch[2] : image;
    mimeType = dataUrlMatch?.[1] || (typeof body?.mimeType === "string" ? body.mimeType : "") || "image/jpeg";
    buffer = Buffer.from(base64Payload, "base64");
  } else {
    const formData = await request.formData();
    const uploadedFile = formData.get("file");
    const uploadedSubdir = formData.get("subdir");

    if (uploadedSubdir === "recipes" || uploadedSubdir === "cook-logs") {
      subdir = uploadedSubdir;
    }

    if (uploadedFile instanceof File) {
      file = uploadedFile;
    }
  }

  if (subdir !== "recipes" && subdir !== "cook-logs") {
    return new Response(JSON.stringify({ error: "Invalid subdir" }), { status: 400 });
  }

  if (!file && (!buffer || !mimeType)) {
    return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
  }

  try {
    const paths = file
      ? await processAndSaveImage(file, subdir)
      : await processAndSaveImageBuffer(buffer!, mimeType!, subdir);

    return new Response(JSON.stringify(paths), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
};
