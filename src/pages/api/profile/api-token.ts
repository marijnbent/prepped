import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { createApiToken } from "../../../lib/api-auth";
import { db } from "../../../lib/db";
import { users } from "../../../lib/schema";

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const createdAt = new Date();
  const apiToken = createApiToken();

  db.update(users)
    .set({
      apiTokenHash: apiToken.hash,
      apiTokenPreview: apiToken.preview,
      apiTokenCreatedAt: createdAt,
      apiTokenLastUsedAt: null,
      updatedAt: createdAt,
    })
    .where(eq(users.id, locals.user.id))
    .run();

  return new Response(JSON.stringify({
    token: apiToken.token,
    preview: apiToken.preview,
    createdAt: createdAt.toISOString(),
    lastUsedAt: null,
  }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  db.update(users)
    .set({
      apiTokenHash: null,
      apiTokenPreview: null,
      apiTokenCreatedAt: null,
      apiTokenLastUsedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, locals.user.id))
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
