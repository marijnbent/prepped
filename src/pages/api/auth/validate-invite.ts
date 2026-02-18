import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  const inviteCode = import.meta.env.INVITE_CODE;
  if (!inviteCode) {
    return new Response(null, { status: 200 });
  }

  const body = await request.json();
  if (body.code === inviteCode) {
    return new Response(null, { status: 200 });
  }

  return new Response(JSON.stringify({ error: "Invalid invite code" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
};
