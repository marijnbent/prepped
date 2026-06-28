import type { APIRoute } from "astro";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../../lib/db";
import { notifications } from "../../../lib/schema";

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientId, locals.user.id), isNull(notifications.readAt)))
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
