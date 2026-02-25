import type { APIRoute } from "astro";
import { generateObject } from "ai";
import { withChatModelFallback } from "../../../lib/ai";
import sharp from "sharp";
import { toAiClientError } from "../../../lib/ai-errors";
import {
  recipeOutputSchema,
  resolveTagIds,
  resolveCollectionIds,
  getImportContext,
  buildImportRules,
} from "../../../lib/import-shared";

const PHOTO_MAX_FILES = 5;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  const photoBuffers: Buffer[] = [];

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as { photos?: unknown } | null;
    const photos = Array.isArray(body?.photos) ? body.photos : [];

    for (const photo of photos) {
      if (typeof photo !== "string") continue;
      const base64Payload = photo.includes(",") ? photo.split(",")[1] : photo;
      if (!base64Payload) continue;
      photoBuffers.push(Buffer.from(base64Payload, "base64"));
    }
  } else {
    const formData = await request.formData();
    const photoEntries = formData.getAll("photo");
    const photos = photoEntries.filter((entry): entry is File => entry instanceof File);

    for (const photo of photos) {
      photoBuffers.push(Buffer.from(await photo.arrayBuffer()));
    }
  }

  if (photoBuffers.length === 0) {
    return new Response(JSON.stringify({ error: "At least one photo is required" }), { status: 400 });
  }

  if (photoBuffers.length > PHOTO_MAX_FILES) {
    return new Response(JSON.stringify({ error: `You can upload up to ${PHOTO_MAX_FILES} photos` }), { status: 400 });
  }

  const ctx = getImportContext(locals.user.id);
  const rules = buildImportRules(ctx);

  try {
    const base64Photos = await Promise.all(
      photoBuffers.map(async (buffer) => {
        const processed = await sharp(buffer)
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        return processed.toString("base64");
      })
    );

    const imageContent = base64Photos.map((base64) => ({
      type: "image" as const,
      image: `data:image/jpeg;base64,${base64}`,
    }));

    const { object: recipe } = await withChatModelFallback((model) =>
      generateObject({
        model,
        schema: recipeOutputSchema,
        messages: [
          {
            role: "user",
            content: [
              ...imageContent,
              {
                type: "text",
                text: `Extract a structured recipe from ${photoBuffers.length > 1 ? "these photos" : "this photo"} of a cookbook page or recipe. If there are multiple photos, combine all pages into one complete recipe.

${rules}${ctx.userInstruction}`,
              },
            ],
          },
        ],
      })
    );

    const tagIds = recipe.tags?.length ? resolveTagIds(recipe.tags) : [];
    const collectionIds = recipe.collections?.length
      ? resolveCollectionIds(recipe.collections, locals.user.id)
      : [];

    return new Response(
      JSON.stringify({
        ...recipe,
        tagIds,
        collectionIds,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (
      rawMessage.includes("unsupported image format") ||
      rawMessage.includes("heif") ||
      rawMessage.includes("heic")
    ) {
      return new Response(
        JSON.stringify({ error: "Could not process this image format. Please use JPG, PNG, or WebP." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const normalized = toAiClientError(err);
    console.error("[recipes/import-photo] AI request failed", {
      code: normalized.code,
      details: normalized.details,
    });

    return new Response(
      JSON.stringify({ error: normalized.message, code: normalized.code }),
      {
        status: normalized.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
