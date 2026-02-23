import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { slugify } from "@/lib/slugify";
import { seedUserDefaults } from "@/lib/seed";

function generateId(length = 21): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (const byte of bytes) {
    result += chars[byte % chars.length];
  }
  return result;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return new Response(JSON.stringify({ message: "Name is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Find user by name (case-insensitive)
  let user = db
    .select()
    .from(users)
    .where(sql`lower(${users.name}) = ${name.toLowerCase()}`)
    .get();

  if (!user) {
    const id = generateId();
    const slug = slugify(name) || "user";
    const email = `${slug}@family.local`;
    const now = new Date();

    db.insert(users)
      .values({
        id,
        name,
        email,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    seedUserDefaults(id, import.meta.env.PUBLIC_UI_LOCALE);
    user = db.select().from(users).where(eq(users.id, id)).get()!;
  }

  cookies.set("simple_session", user.id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
