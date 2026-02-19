import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { recipes, recipeTags, recipeCollections, tags } from "../../../lib/schema";
import { recipeSchema } from "../../../lib/validation";
import { slugify } from "../../../lib/slugify";
import { eq, and } from "drizzle-orm";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const result = recipeSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten() }), { status: 400 });
  }

  const data = result.data;
  let slug = slugify(data.title);

  // Ensure unique slug within this user's recipes
  const existing = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.slug, slug), eq(recipes.createdBy, locals.user.id)))
    .get();
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const recipe = db
    .insert(recipes)
    .values({
      title: data.title,
      slug,
      description: data.description || null,
      ingredients: data.ingredients,
      steps: data.steps,
      servings: data.servings || null,
      prepTime: data.prepTime || null,
      cookTime: data.cookTime || null,
      difficulty: data.difficulty || null,
      imageUrl: data.imageUrl || null,
      sourceUrl: data.sourceUrl || null,
      videoUrl: data.videoUrl || null,
      notes: data.notes || null,
      isPublished: data.isPublished ?? true,
      createdBy: locals.user.id,
    })
    .returning()
    .get();

  // Handle tags
  if (data.tagIds?.length) {
    for (const tagId of data.tagIds) {
      db.insert(recipeTags).values({ recipeId: recipe.id, tagId }).run();
    }
  }

  // Handle collections
  if (data.collectionIds?.length) {
    for (const collectionId of data.collectionIds) {
      db.insert(recipeCollections).values({ recipeId: recipe.id, collectionId }).run();
    }
  }

  return new Response(JSON.stringify(recipe), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
