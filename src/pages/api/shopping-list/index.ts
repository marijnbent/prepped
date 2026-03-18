import type { APIRoute } from "astro";
import {
  clearShoppingListStateForUser,
  getShoppingListStateForUser,
  saveShoppingListStateForUser,
} from "../../../lib/shopping-list-db";

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const state = getShoppingListStateForUser(locals.user.id);

  return new Response(JSON.stringify(state), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const state = saveShoppingListStateForUser(locals.user.id, body);

  return new Response(JSON.stringify(state), {
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const state = clearShoppingListStateForUser(locals.user.id);

  return new Response(JSON.stringify(state), {
    headers: { "Content-Type": "application/json" },
  });
};
