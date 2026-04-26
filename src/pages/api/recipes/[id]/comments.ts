import type { APIRoute } from "astro";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { notifications, recipeComments, recipes, users } from "../../../../lib/schema";
import { recipeCommentSchema } from "../../../../lib/validation";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

export const GET: APIRoute = async ({ params }) => {
  const recipeId = Number(params.id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return json({ error: "Invalid recipe id" }, { status: 400 });
  }

  const recipe = db.select().from(recipes).where(eq(recipes.id, recipeId)).get();
  if (!recipe || !recipe.isPublished) {
    return json({ error: "Recipe not found" }, { status: 404 });
  }

  const comments = db
    .select({
      id: recipeComments.id,
      body: recipeComments.body,
      reaction: recipeComments.reaction,
      createdAt: recipeComments.createdAt,
      authorId: recipeComments.authorId,
      authorName: users.name,
    })
    .from(recipeComments)
    .innerJoin(users, eq(recipeComments.authorId, users.id))
    .where(eq(recipeComments.recipeId, recipeId))
    .orderBy(desc(recipeComments.createdAt))
    .all();

  return json({ comments });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipeId = Number(params.id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return json({ error: "Invalid recipe id" }, { status: 400 });
  }

  const recipe = db.select().from(recipes).where(eq(recipes.id, recipeId)).get();
  if (!recipe || (recipe.createdBy !== locals.user.id && !recipe.isPublished)) {
    return json({ error: "Recipe not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = recipeCommentSchema.safeParse(body);
  if (!result.success) {
    return json({ error: result.error.flatten() }, { status: 400 });
  }

  const data = result.data;
  const comment = db
    .insert(recipeComments)
    .values({
      recipeId,
      authorId: locals.user.id,
      body: data.body || null,
      reaction: data.reaction || null,
    })
    .returning()
    .get();

  if (recipe.createdBy !== locals.user.id) {
    db.insert(notifications)
      .values({
        recipientId: recipe.createdBy,
        actorId: locals.user.id,
        recipeId,
        commentId: comment.id,
        type: "recipe_comment",
      })
      .run();
  }

  const created = db
    .select({
      id: recipeComments.id,
      body: recipeComments.body,
      reaction: recipeComments.reaction,
      createdAt: recipeComments.createdAt,
      authorId: recipeComments.authorId,
      authorName: users.name,
    })
    .from(recipeComments)
    .innerJoin(users, eq(recipeComments.authorId, users.id))
    .where(and(eq(recipeComments.id, comment.id), eq(recipeComments.recipeId, recipeId)))
    .get();

  return json(created, { status: 201 });
};
