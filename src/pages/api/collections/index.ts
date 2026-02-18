import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { collections } from "../../../lib/schema";
import { collectionSchema } from "../../../lib/validation";
import { slugify } from "../../../lib/slugify";
import { eq } from "drizzle-orm";

export const GET: APIRoute = async () => {
  const all = db.select({ id: collections.id, name: collections.name }).from(collections).all();
  return new Response(JSON.stringify(all), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const result = collectionSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten() }), { status: 400 });
  }

  const data = result.data;
  let slug = slugify(data.name);
  const existing = db.select().from(collections).where(eq(collections.slug, slug)).get();
  if (existing) slug = `${slug}-${Date.now()}`;

  const collection = db
    .insert(collections)
    .values({
      name: data.name,
      slug,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      sortOrder: data.sortOrder || 0,
      createdBy: locals.user.id,
    })
    .returning()
    .get();

  return new Response(JSON.stringify(collection), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
