import type { APIRoute } from "astro";
import { auth, SSO_PROVIDER_ID, ssoEnabled } from "@/lib/auth";

export const GET: APIRoute = async ({ url }) => {
  if (!ssoEnabled) return new Response(null, { status: 404 });

  const requested = url.searchParams.get("redirect") ?? "/";
  const callbackURL = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  const silent = url.searchParams.has("silent");

  const response = await auth.handler(
    new Request(new URL("/api/auth/sign-in/social", url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: SSO_PROVIDER_ID, callbackURL, errorCallbackURL: silent ? callbackURL : "/login?error=sso" }),
    }),
  );
  const result = (await response.json()) as { url?: string };
  if (!response.ok || !result.url) return Response.redirect(new URL("/login?error=sso", url), 302);

  const target = new URL(result.url);
  if (silent) target.searchParams.set("prompt", "none");

  const headers = new Headers({ location: target.toString() });
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
};
