import type { APIRoute } from "astro";
import { auth } from "@/lib/auth";
import { ID_TOKEN_COOKIE, providerLogoutUrl } from "@/lib/oidc";

export const POST: APIRoute = async ({ request, cookies }) => {
  const context = await auth.$context;
  const idToken = cookies.get(context.createAuthCookie(ID_TOKEN_COOKIE).name)?.value;
  const response = await auth.api.signOut({ headers: request.headers, asResponse: true });
  const url = (await providerLogoutUrl(idToken, new URL("/", context.baseURL).href)) ?? "/login?local";

  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify({ url }), { headers });
};
