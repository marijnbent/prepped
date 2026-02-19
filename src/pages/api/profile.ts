import type { APIRoute } from "astro";
import { db } from "../../lib/db";
import { users } from "../../lib/schema";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const importPrompt = typeof body.importPrompt === "string" ? body.importPrompt.slice(0, 500) : null;
  const chatPrompt = typeof body.chatPrompt === "string" ? body.chatPrompt.slice(0, 500) : null;

  db.update(users)
    .set({
      importPrompt: importPrompt || null,
      chatPrompt: chatPrompt || null,
    })
    .where(eq(users.id, locals.user.id))
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
