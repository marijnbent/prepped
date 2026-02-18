import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { cookLogs } from "../../../lib/schema";
import { cookLogSchema } from "../../../lib/validation";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const result = cookLogSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten() }), { status: 400 });
  }

  const data = result.data;

  const log = db
    .insert(cookLogs)
    .values({
      recipeId: data.recipeId,
      photoUrl: data.photoUrl || null,
      notes: data.notes || null,
      rating: data.rating || null,
      cookedAt: data.cookedAt ? new Date(data.cookedAt) : new Date(),
      createdBy: locals.user.id,
    })
    .returning()
    .get();

  return new Response(JSON.stringify(log), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
