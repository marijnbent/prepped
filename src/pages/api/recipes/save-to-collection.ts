import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { recipeCollections, collections, recipes } from "../../../lib/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const saveSchema = z.object({
  recipeId: z.number().int().positive(),
  collectionIds: z.array(z.number().int().positive()),
});

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const result = saveSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten() }), { status: 400 });
  }

  const { recipeId, collectionIds } = result.data;

  // Verify recipe exists
  const recipe = db.select().from(recipes).where(eq(recipes.id, recipeId)).get();
  if (!recipe) {
    return new Response(JSON.stringify({ error: "Recipe not found" }), { status: 404 });
  }
  if (recipe.createdBy !== locals.user.id && !recipe.isPublished) {
    return new Response(JSON.stringify({ error: "Recipe not found" }), { status: 404 });
  }

  // Get all user's collections
  const userCollections = db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.createdBy, locals.user.id))
    .all();
  const userCollectionIds = new Set(userCollections.map((c) => c.id));

  // Get current saved state for this recipe across user's collections
  const currentSaved = db
    .select({ collectionId: recipeCollections.collectionId })
    .from(recipeCollections)
    .innerJoin(collections, eq(recipeCollections.collectionId, collections.id))
    .where(and(eq(recipeCollections.recipeId, recipeId), eq(collections.createdBy, locals.user.id)))
    .all()
    .map((r) => r.collectionId);
  const currentSet = new Set(currentSaved);
  const desiredSet = new Set([...new Set(collectionIds)].filter((id) => userCollectionIds.has(id)));

  const { added, removed } = db.transaction((tx) => {
    let addedCount = 0;
    for (const colId of desiredSet) {
      if (!currentSet.has(colId)) {
        tx.insert(recipeCollections).values({ recipeId, collectionId: colId }).run();
        addedCount++;
      }
    }

    let removedCount = 0;
    for (const colId of currentSet) {
      if (!desiredSet.has(colId)) {
        tx.delete(recipeCollections)
          .where(and(eq(recipeCollections.recipeId, recipeId), eq(recipeCollections.collectionId, colId)))
          .run();
        removedCount++;
      }
    }

    return { added: addedCount, removed: removedCount };
  });

  return new Response(JSON.stringify({ added, removed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
