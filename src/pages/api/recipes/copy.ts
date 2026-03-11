import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { recipes, recipeTags, recipeCollections, collections } from "../../../lib/schema";
import { copyRecipeSchema } from "../../../lib/validation";
import { slugify } from "../../../lib/slugify";
import { eq, and, asc, inArray } from "drizzle-orm";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const result = copyRecipeSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten() }), { status: 400 });
  }

  const { recipeId, collectionIds } = result.data;

  // Get the source recipe
  const source = db.select().from(recipes).where(eq(recipes.id, recipeId)).get();
  if (!source) {
    return new Response(JSON.stringify({ error: "Recipe not found" }), { status: 404 });
  }
  if (source.createdBy !== locals.user.id && !source.isPublished) {
    return new Response(JSON.stringify({ error: "Recipe not found" }), { status: 404 });
  }

  // Generate slug scoped to user
  let slug = slugify(source.title);
  const existing = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.slug, slug), eq(recipes.createdBy, locals.user.id)))
    .get();
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  // Copy tags (tags are global)
  const sourceTagIds = db
    .select({ tagId: recipeTags.tagId })
    .from(recipeTags)
    .where(eq(recipeTags.recipeId, recipeId))
    .all()
    .map((row) => row.tagId);

  // Assign to user's selected collections, with a fallback to the first collection
  const collectionIdsToUse = [...new Set(collectionIds || [])];
  if (collectionIdsToUse.length === 0) {
    const defaultCollection = db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.createdBy, locals.user.id))
      .orderBy(asc(collections.sortOrder), asc(collections.id))
      .get();
    if (defaultCollection) {
      collectionIdsToUse.push(defaultCollection.id);
    }
  }

  const copy = db.transaction((tx) => {
    const created = tx
      .insert(recipes)
      .values({
        title: source.title,
        slug,
        description: source.description,
        ingredients: source.ingredients,
        cookingSupplies: source.cookingSupplies,
        steps: source.steps,
        servings: source.servings,
        prepTime: source.prepTime,
        cookTime: source.cookTime,
        difficulty: source.difficulty,
        imageUrl: source.imageUrl, // reference same image files
        imageProvider: source.imageProvider,
        imageAuthorName: source.imageAuthorName,
        imageAuthorUrl: source.imageAuthorUrl,
        imageSourceUrl: source.imageSourceUrl,
        sourceUrl: source.sourceUrl,
        videoUrl: source.videoUrl,
        notes: source.notes,
        isPublished: true,
        copiedFrom: source.id,
        createdBy: locals.user.id,
      })
      .returning()
      .get();

    if (sourceTagIds.length > 0) {
      tx.insert(recipeTags)
        .values(sourceTagIds.map((tagId) => ({ recipeId: created.id, tagId })))
        .run();
    }

    if (collectionIdsToUse.length > 0) {
      const allowedCollections = tx
        .select({ id: collections.id })
        .from(collections)
        .where(and(eq(collections.createdBy, locals.user.id), inArray(collections.id, collectionIdsToUse)))
        .all()
        .map((col) => col.id);

      if (allowedCollections.length > 0) {
        tx.insert(recipeCollections)
          .values(allowedCollections.map((collectionId) => ({ recipeId: created.id, collectionId })))
          .run();
      }
    }

    return created;
  });

  return new Response(JSON.stringify({ slug: copy.slug }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
