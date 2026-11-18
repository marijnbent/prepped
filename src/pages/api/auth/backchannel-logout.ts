import type { APIRoute } from "astro";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { readLogoutToken, SSO_PROVIDER_ID } from "@/lib/oidc";
import { accounts, sessions } from "@/lib/schema";

export const POST: APIRoute = async ({ request }) => {
  const token = (await request.formData().catch(() => null))?.get("logout_token");
  const subject = typeof token === "string" ? await readLogoutToken(token) : null;
  if (!subject) return new Response(null, { status: 400 });

  const users = db
    .select({ id: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.providerId, SSO_PROVIDER_ID), eq(accounts.accountId, subject)));
  db.delete(sessions).where(inArray(sessions.userId, users)).run();

  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};
