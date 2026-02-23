import type { APIRoute } from "astro";
import { generateObject } from "ai";
import { z } from "zod";
import { withChatModelFallback } from "../../../lib/ai";
import { db } from "../../../lib/db";
import { users } from "../../../lib/schema";
import { eq } from "drizzle-orm";
import { toAiClientError } from "../../../lib/ai-errors";

const organizeOutputSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string(),
      items: z.array(
        z.object({
          amount: z.string(),
          unit: z.string(),
          name: z.string(),
        })
      ),
    })
  ),
});

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { ingredients } = await request.json();
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return new Response(JSON.stringify({ error: "Ingredients required" }), { status: 400 });
  }

  const userRow = db
    .select({ shoppingPrompt: users.shoppingPrompt })
    .from(users)
    .where(eq(users.id, locals.user.id))
    .get();

  try {
    const userInstruction = userRow?.shoppingPrompt
      ? `\n\nHIGHEST PRIORITY — the user's personal instruction (override other rules if conflicting):\n${userRow.shoppingPrompt}`
      : "";

    const ingredientList = ingredients
      .map((ing: { amount: string; unit: string; name: string }) =>
        `${ing.amount} ${ing.unit} ${ing.name}`.trim()
      )
      .join("\n");

    const { object: result } = await withChatModelFallback((model) =>
      generateObject({
        model,
        schema: organizeOutputSchema,
        prompt: `You are a shopping list organizer. Given a list of ingredients, merge duplicates intelligently, round amounts to practical shopping quantities, and organize them by supermarket category.

CRITICAL RULES:
- KEEP THE SAME LANGUAGE as the input ingredients. If the ingredients are in Dutch, use Dutch category names and Dutch ingredient names. If in English, use English. NEVER translate ingredient names or category names to a different language.
- Merge ingredients that are clearly the same item (e.g. "200g onion" + "150g onion" = "350g onion")
- Round amounts to practical quantities (e.g. 267g butter → 250g butter, 3.5 onions → 4 onions)
- Common pantry/cupboard staples that most people already have at home (salt, pepper, oil, butter, garlic, onion, basic dried herbs and spices, flour, sugar, vinegar, soy sauce, etc.) should be grouped into a "Cupboard" category (translated to match the ingredient language, e.g. "Voorraadkast" in Dutch). This keeps the shopping-relevant ingredients separate from what's already in the kitchen.
- EXCEPTION for pantry staples: if the required amount is significant, do NOT place it in Cupboard; place it in a normal shopping category. Examples: butter > 50g, oil > 100ml, flour/sugar > 100g, or onion/garlic >= 3 pieces.
- Order categories as: Produce → Dairy & Eggs → Meat & Fish → Bakery → Pantry → Spices → Frozen → Cupboard → Other (translate category names to match the ingredient language). Put Cupboard near the end since those items are lowest priority to buy.
- Only include categories that have items
- For items without clear amounts, keep them as-is

Ingredients:
${ingredientList}${userInstruction}`,
      })
    );

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const normalized = toAiClientError(err);
    console.error("[shopping-list/organize] AI request failed", {
      code: normalized.code,
      details: normalized.details,
    });

    return new Response(
      JSON.stringify({ error: normalized.message, code: normalized.code }),
      {
        status: normalized.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
