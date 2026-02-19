import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { recipes, recipeTags, recipeCollections } from "../../../lib/schema";
import { recipeSchema } from "../../../lib/validation";
import { slugify } from "../../../lib/slugify";
import { eq, and, ne } from "drizzle-orm";

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), { status: 400 });
  }

  // Verify ownership
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!recipe) {
    return new Response(JSON.stringify({ error: "Recipe not found" }), { status: 404 });
  }
  if (recipe.createdBy !== locals.user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const body = await request.json();
  const result = recipeSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten() }), { status: 400 });
  }

  const data = result.data;
  let slug = slugify(data.title);

  // Ensure unique slug within this user's recipes (excluding current recipe)
  const existing = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.slug, slug), eq(recipes.createdBy, locals.user.id), ne(recipes.id, id)))
    .get();
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const updated = db
    .update(recipes)
    .set({
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
      updatedAt: new Date(),
    })
    .where(eq(recipes.id, id))
    .returning()
    .get();

  // Update tags
  db.delete(recipeTags).where(eq(recipeTags.recipeId, id)).run();
  if (data.tagIds?.length) {
    for (const tagId of data.tagIds) {
      db.insert(recipeTags).values({ recipeId: id, tagId }).run();
    }
  }

  // Update collections
  db.delete(recipeCollections).where(eq(recipeCollections.recipeId, id)).run();
  if (data.collectionIds?.length) {
    for (const collectionId of data.collectionIds) {
      db.insert(recipeCollections).values({ recipeId: id, collectionId }).run();
    }
  }

  return new Response(JSON.stringify(updated), {
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), { status: 400 });
  }

  // Verify ownership
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!recipe) {
    return new Response(null, { status: 204 });
  }
  if (recipe.createdBy !== locals.user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  db.delete(recipes).where(eq(recipes.id, id)).run();

  return new Response(null, { status: 204 });
};
