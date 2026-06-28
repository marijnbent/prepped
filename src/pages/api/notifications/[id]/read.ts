import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { notifications } from "../../../../lib/schema";

export const POST: APIRoute = async ({ params, locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Invalid notification id" }, { status: 400 });
  }

  db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, locals.user.id)))
    .run();

  return json({ ok: true });
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });
}
