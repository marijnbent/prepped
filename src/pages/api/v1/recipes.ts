import type { APIRoute } from "astro";
import { getRequestUser } from "../../../lib/api-auth";
import { createRecipeForUser, normalizeRecipeCreateInput, RecipeEnhanceError } from "../../../lib/recipe-create";
import { apiRecipeCreateSchema } from "../../../lib/validation";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = await getRequestUser(request, locals);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = apiRecipeCreateSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.flatten(), issues: result.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const data = await normalizeRecipeCreateInput(result.data, user.id);
    const recipe = createRecipeForUser(data, user.id);

    return new Response(JSON.stringify(recipe), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create recipe";
    const status = error instanceof RecipeEnhanceError ? error.status : 400;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
