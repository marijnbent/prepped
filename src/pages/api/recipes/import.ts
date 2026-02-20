import type { APIRoute } from "astro";
import { generateObject } from "ai";
import { z } from "zod";
import { getChatModel } from "../../../lib/ai";
import { scrapeUrl, ScrapeError } from "../../../lib/scraper";
import { db } from "../../../lib/db";
import { tags, collections, users } from "../../../lib/schema";
import { eq, and } from "drizzle-orm";
import { slugify } from "../../../lib/slugify";
import { downloadAndSaveImage } from "../../../lib/images";
import { t } from "../../../lib/i18n";
import { defaultCollections, defaultTags } from "../../../lib/defaults";
import { toAiClientError } from "../../../lib/ai-errors";

const recipeOutputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  ingredients: z.array(
    z.object({
      amount: z.string(),
      unit: z.string(),
      name: z.string(),
      group: z.string().optional(),
    })
  ),
  steps: z.array(
    z.object({
      order: z.number(),
      instruction: z.string(),
      duration: z.number().optional(),
    })
  ),
  servings: z.number().optional(),
  prepTime: z.number().optional(),
  cookTime: z.number().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
});

function resolveTagIds(tagNames: string[]): number[] {
  const ids: number[] = [];
  for (const name of tagNames) {
    const slug = slugify(name);
    if (!slug) continue;
    const existing = db.select().from(tags).where(eq(tags.slug, slug)).get();
    if (existing) {
      ids.push(existing.id);
    } else {
      const created = db.insert(tags).values({ name: name.trim().toLowerCase(), slug }).returning().get();
      ids.push(created.id);
    }
  }
  return ids;
}

function resolveCollectionIds(collectionNames: string[], userId: string): number[] {
  const ids: number[] = [];
  for (const name of collectionNames) {
    const slug = slugify(name);
    if (!slug) continue;
    const existing = db
      .select()
      .from(collections)
      .where(and(eq(collections.slug, slug), eq(collections.createdBy, userId)))
      .get();
    if (existing) {
      ids.push(existing.id);
    } else {
      const created = db
        .insert(collections)
        .values({ name: name.trim(), slug, createdBy: userId })
        .returning()
        .get();
      ids.push(created.id);
    }
  }
  return ids;
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { url } = await request.json();
  if (!url || typeof url !== "string") {
    return new Response(JSON.stringify({ error: "URL required" }), { status: 400 });
  }

  // Fetch existing tags and collections to help the AI pick from them
  const existingTags = db.select().from(tags).all();
  const existingCollections = db
    .select()
    .from(collections)
    .where(eq(collections.createdBy, locals.user.id))
    .all();

  const existingTagNames = existingTags.map((t) => t.name);
  const existingCollectionNames = existingCollections.map((c) => c.name);

  const userRow = db.select({ importPrompt: users.importPrompt }).from(users).where(eq(users.id, locals.user.id)).get();

  try {
    const { title, content, imageUrl, videoUrl } = await scrapeUrl(url);

    const userInstruction = userRow?.importPrompt
      ? `\n\nHIGHEST PRIORITY — the user's personal instruction (override other rules if conflicting):\n${userRow.importPrompt}`
      : "";

    const { object: recipe } = await generateObject({
      model: getChatModel(),
      schema: recipeOutputSchema,
      prompt: `Extract a structured recipe from the following web page content.

IMPORTANT RULES:
- Convert ALL measurements to metric (grams, ml, liters, celsius). For example:
  - cups of flour → grams (1 cup flour ≈ 125g)
  - cups of sugar → grams (1 cup sugar ≈ 200g)
  - cups of butter → grams (1 cup butter ≈ 227g)
  - cups of liquid → ml (1 cup ≈ 240ml)
  - tablespoons → ml or grams as appropriate (1 tbsp ≈ 15ml)
  - teaspoons → ml (1 tsp ≈ 5ml) — but keep "tsp" for small amounts like spices
  - ounces → grams (1 oz ≈ 28g)
  - pounds → grams (1 lb ≈ 454g)
  - Fahrenheit → Celsius in step instructions (e.g., 350°F → 175°C)
  - inches → cm
- Keep the recipe title exactly as it appears on the page — do not translate it, do not change capitalization, do not "correct" spelling. Only fix ALL CAPS to normal sentence case (capitalize first word only).
- Keep ingredient amounts as strings (e.g., "250", "0.5", "a pinch")
- If amounts are given as fractions (like 1/2), convert to decimal (0.5)
- Extract all preparation steps in order with clear instructions
- Include any tips, notes, or serving suggestions from the recipe in the "notes" field
- For "to taste" / unquantified ingredients (salt, pepper, oil, herbs used as garnish, etc.): always list each ingredient separately (never combine like "salt and pepper"), leave amount empty, and keep the name clean (just the ingredient, no "to taste" or "naar smaak" suffix).
- Translate all ingredient names and group names to ${t("site.language")}. Keep the recipe title as-is, but ingredient names should be in the local language.
- For ingredient grouping: common pantry/cupboard staples (salt, pepper, oil, butter, garlic, onion, basic dried herbs and spices, flour, sugar, vinegar, soy sauce, etc.) should be grouped under "${t("recipe.cupboard")}" if the recipe doesn't already organize them into a specific group. This keeps the shopping-relevant ingredients separate from what's already in the kitchen.
- For tags: always lowercase (e.g., "cookies", "pasta", "vegetarian"). Prefer existing: [${existingTagNames.join(", ")}]. Add new ones if needed. Defaults for reference: [${defaultTags.join(", ")}].
- For collections: use Title Case with an emoji prefix. Prefer existing: [${existingCollectionNames.join(", ")}]. Only create new if nothing fits. Defaults for reference: [${defaultCollections.join(", ")}].

Page title: ${title}

Content:
${content.slice(0, 10000)}${userInstruction}`,
    });

    // Resolve tag and collection names to IDs
    const tagIds = recipe.tags?.length ? resolveTagIds(recipe.tags) : [];
    const collectionIds = recipe.collections?.length
      ? resolveCollectionIds(recipe.collections, locals.user.id)
      : [];

    // Download external image and store locally
    let localImageUrl: string | undefined;
    if (imageUrl) {
      try {
        const { full } = await downloadAndSaveImage(imageUrl, "recipes");
        localImageUrl = full;
      } catch {
        // Fall back to external URL if download fails
        localImageUrl = imageUrl;
      }
    }

    return new Response(
      JSON.stringify({
        ...recipe,
        tagIds,
        collectionIds,
        sourceUrl: url,
        imageUrl: localImageUrl,
        videoUrl: videoUrl || undefined,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    if (err instanceof ScrapeError) {
      console.error("[recipes/import] Scrape failed", { code: err.code, message: err.message });
      const message = err.code === "SCRAPE_BLOCKED"
        ? "This website blocks automated access. Try copying the recipe text and using paste import instead."
        : `Could not read the page: ${err.message}`;
      return new Response(
        JSON.stringify({ error: message, code: err.code }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }

    const normalized = toAiClientError(err);
    console.error("[recipes/import] AI request failed", {
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
