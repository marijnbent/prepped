import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { collections } from "../../../lib/schema";
import { collectionSchema } from "../../../lib/validation";
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
  const collection = db.select().from(collections).where(eq(collections.id, id)).get();
  if (!collection) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }
  if (collection.createdBy !== locals.user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const body = await request.json();
  const result = collectionSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten() }), { status: 400 });
  }

  const data = result.data;
  let slug = slugify(data.name);
  const existing = db
    .select()
    .from(collections)
    .where(and(eq(collections.slug, slug), eq(collections.createdBy, locals.user.id), ne(collections.id, id)))
    .get();
  if (existing) slug = `${slug}-${Date.now()}`;

  const updated = db
    .update(collections)
    .set({
      name: data.name,
      slug,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      sortOrder: data.sortOrder || 0,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, id))
    .returning()
    .get();

  if (!updated) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  return new Response(JSON.stringify(updated), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ params, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), { status: 400 });
  }

  // Verify ownership
  const collection = db.select().from(collections).where(eq(collections.id, id)).get();
  if (!collection) {
    return new Response(null, { status: 204 });
  }
  if (collection.createdBy !== locals.user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  db.delete(collections).where(eq(collections.id, id)).run();
  return new Response(null, { status: 204 });
};
