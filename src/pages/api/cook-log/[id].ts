import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { cookLogs } from "../../../lib/schema";
import { cookLogSchema } from "../../../lib/validation";
import { eq } from "drizzle-orm";

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), { status: 400 });
  }

  // Verify ownership
  const log = db.select().from(cookLogs).where(eq(cookLogs.id, id)).get();
  if (!log) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }
  if (log.createdBy !== locals.user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const body = await request.json();
  const result = cookLogSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten() }), { status: 400 });
  }

  const data = result.data;

  const updated = db
    .update(cookLogs)
    .set({
      photoUrl: data.photoUrl || null,
      notes: data.notes || null,
      rating: data.rating || null,
      cookedAt: data.cookedAt ? new Date(data.cookedAt) : undefined,
    })
    .where(eq(cookLogs.id, id))
    .returning()
    .get();

  if (!updated) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
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
  const log = db.select().from(cookLogs).where(eq(cookLogs.id, id)).get();
  if (!log) {
    return new Response(null, { status: 204 });
  }
  if (log.createdBy !== locals.user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  db.delete(cookLogs).where(eq(cookLogs.id, id)).run();
  return new Response(null, { status: 204 });
};
