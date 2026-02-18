import type { APIRoute } from "astro";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { getChatModel } from "../../../../lib/ai";
import { db } from "../../../../lib/db";
import { recipes } from "../../../../lib/schema";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), { status: 400 });
  }

  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!recipe) {
    return new Response(JSON.stringify({ error: "Recipe not found" }), { status: 404 });
  }

  const ingredients = (recipe.ingredients as any[])
    .map((i: any) => `${i.amount} ${i.unit} ${i.name}`.trim())
    .join("\n");

  const steps = (recipe.steps as any[])
    .map((s: any) => `${s.order}. ${s.instruction}`)
    .join("\n");

  const measurementSystem = import.meta.env.MEASUREMENT_SYSTEM || process.env.MEASUREMENT_SYSTEM || "metric";

  const systemPrompt = `You are a helpful cooking assistant. You have full knowledge of the following recipe and can answer questions about it - substitutions, technique tips, serving suggestions, dietary adaptations, etc. Be concise and practical.

Respond in plain text only. You may use **bold** for emphasis when needed, but no other markdown formatting (no headers, lists, links, or code blocks).

The user prefers ${measurementSystem} measurements. Use ${measurementSystem === "metric" ? "grams, ml, °C" : "oz, cups, °F"} when mentioning quantities or temperatures.

Recipe: ${recipe.title}
${recipe.description ? `Description: ${recipe.description}` : ""}
Servings: ${recipe.servings || "Not specified"}
Prep Time: ${recipe.prepTime ? `${recipe.prepTime} min` : "Not specified"}
Cook Time: ${recipe.cookTime ? `${recipe.cookTime} min` : "Not specified"}

Ingredients:
${ingredients}

Steps:
${steps}

${recipe.notes ? `Notes: ${recipe.notes}` : ""}`;

  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: getChatModel(),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
};
