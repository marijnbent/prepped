import type { APIRoute } from "astro";
import { recipeSchema } from "../../../lib/validation";
import { createRecipeForUser } from "../../../lib/recipe-create";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const result = recipeSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten(), issues: result.error.issues }), { status: 400 });
  }

  const recipe = createRecipeForUser(result.data, locals.user.id);

  return new Response(JSON.stringify(recipe), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
