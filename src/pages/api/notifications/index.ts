import type { APIRoute } from "astro";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../../lib/db";
import { notifications, recipeComments, recipes, users } from "../../../lib/schema";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = db
    .select({
      id: notifications.id,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorName: users.name,
      recipeTitle: recipes.title,
      recipeSlug: recipes.slug,
      recipeOwnerId: recipes.createdBy,
      commentId: recipeComments.id,
      commentBody: recipeComments.body,
      reaction: recipeComments.reaction,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.actorId, users.id))
    .innerJoin(recipes, eq(notifications.recipeId, recipes.id))
    .innerJoin(recipeComments, eq(notifications.commentId, recipeComments.id))
    .where(eq(notifications.recipientId, locals.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(20)
    .all();

  const unread = db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientId, locals.user.id), isNull(notifications.readAt)))
    .get()?.count ?? 0;

  return json({
    unread,
    notifications: rows.map((row) => ({
      ...row,
      href: row.recipeOwnerId === locals.user!.id
        ? `/recipes/${row.recipeSlug}#comment-${row.commentId}`
        : `/users/${row.recipeOwnerId}/recipes/${row.recipeSlug}#comment-${row.commentId}`,
    })),
  });
};
