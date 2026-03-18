import type { APIRoute } from "astro";
import { buildApiDocs } from "../lib/api-docs";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const body = buildApiDocs(url.origin);

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
