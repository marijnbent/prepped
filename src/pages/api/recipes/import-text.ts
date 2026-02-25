import type { APIRoute } from "astro";
import { generateObject } from "ai";
import { withChatModelFallback } from "../../../lib/ai";
import { toAiClientError } from "../../../lib/ai-errors";
import {
  recipeOutputSchema,
  resolveTagIds,
  resolveCollectionIds,
  getImportContext,
  buildImportRules,
} from "../../../lib/import-shared";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { text } = await request.json();
  if (!text || typeof text !== "string") {
    return new Response(JSON.stringify({ error: "Text required" }), { status: 400 });
  }

  const ctx = getImportContext(locals.user.id);
  const rules = buildImportRules(ctx);

  try {
    const { object: recipe } = await withChatModelFallback((model) =>
      generateObject({
        model,
        schema: recipeOutputSchema,
        prompt: `Extract a structured recipe from the following text.

${rules}

Text:
${text.slice(0, 10000)}${ctx.userInstruction}`,
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
    const normalized = toAiClientError(err);
    console.error("[recipes/import-text] AI request failed", {
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
