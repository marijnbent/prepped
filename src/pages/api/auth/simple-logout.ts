import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete("simple_session", { path: "/" });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
