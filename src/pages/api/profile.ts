import type { APIRoute } from "astro";
import { db } from "../../lib/db";
import { users } from "../../lib/schema";
import { eq } from "drizzle-orm";
import { resolveLocale } from "../../lib/i18n";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const importPrompt = typeof body.importPrompt === "string" ? body.importPrompt.slice(0, 500) : null;
  const chatPrompt = typeof body.chatPrompt === "string" ? body.chatPrompt.slice(0, 500) : null;
  const shoppingPrompt = typeof body.shoppingPrompt === "string" ? body.shoppingPrompt.slice(0, 500) : null;
  const cookingSuppliesExpandedByDefault = body.cookingSuppliesExpandedByDefault === true;
  const dirkSecretModeEnabled = body.dirkSecretModeEnabled === true;

  let locale: string | null | undefined;
  if (typeof body.locale === "string") {
    if (body.locale) {
      const resolved = resolveLocale(body.locale);
      if (!resolved) {
        return new Response(JSON.stringify({ error: "Unsupported language" }), { status: 400 });
      }
      locale = resolved;
    } else {
      locale = null;
    }
  }

  db.update(users)
    .set({
      importPrompt: importPrompt || null,
      chatPrompt: chatPrompt || null,
      shoppingPrompt: shoppingPrompt || null,
      ...(locale !== undefined ? { locale } : {}),
      cookingSuppliesExpandedByDefault,
      dirkSecretModeEnabled,
    })
    .where(eq(users.id, locals.user.id))
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
