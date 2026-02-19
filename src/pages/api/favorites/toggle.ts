import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { favorites } from "../../../lib/schema";
import { favoriteToggleSchema } from "../../../lib/validation";
import { eq, and } from "drizzle-orm";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const result = favoriteToggleSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten() }), { status: 400 });
  }

  const { recipeId } = result.data;
  const existing = db
    .select()
    .from(favorites)
    .where(and(eq(favorites.userId, locals.user.id), eq(favorites.recipeId, recipeId)))
    .get();

  if (existing) {
    db.delete(favorites)
      .where(and(eq(favorites.userId, locals.user.id), eq(favorites.recipeId, recipeId)))
      .run();
    return new Response(JSON.stringify({ favorited: false }), {
      headers: { "Content-Type": "application/json" },
    });
  } else {
    db.insert(favorites)
      .values({ userId: locals.user.id, recipeId })
      .run();
    return new Response(JSON.stringify({ favorited: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
