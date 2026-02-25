import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { recipeCollections, collections, recipes } from "../../../lib/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const saveSchema = z.object({
  recipeId: z.number().int().positive(),
  collectionIds: z.array(z.number().int().positive()).min(1),
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

  let added = 0;
  for (const collectionId of collectionIds) {
    // Verify collection belongs to current user
    const col = db
      .select()
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.createdBy, locals.user.id)))
      .get();
    if (!col) continue;

    // Check if already in collection
    const existing = db
      .select()
      .from(recipeCollections)
      .where(and(eq(recipeCollections.recipeId, recipeId), eq(recipeCollections.collectionId, collectionId)))
      .get();
    if (existing) continue;

    db.insert(recipeCollections).values({ recipeId, collectionId }).run();
    added++;
  }

  return new Response(JSON.stringify({ added }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
