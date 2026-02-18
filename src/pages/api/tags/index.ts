import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { tags } from "../../../lib/schema";
import { slugify } from "../../../lib/slugify";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { name } = await request.json();
  if (!name || typeof name !== "string") {
    return new Response(JSON.stringify({ error: "Name required" }), { status: 400 });
  }

  const slug = slugify(name);
  const existing = db.select().from(tags).where(eq(tags.slug, slug)).get();
  if (existing) {
    return new Response(JSON.stringify(existing), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const tag = db.insert(tags).values({ name: name.trim(), slug }).returning().get();

  return new Response(JSON.stringify(tag), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};

export const GET: APIRoute = async () => {
  const allTags = db.select().from(tags).all();
  return new Response(JSON.stringify(allTags), {
    headers: { "Content-Type": "application/json" },
  });
};
