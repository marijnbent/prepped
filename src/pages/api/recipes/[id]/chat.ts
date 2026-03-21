import type { APIRoute } from "astro";
import { generateText } from "ai";
import { withChatModelFallback } from "../../../../lib/ai";
import { toAiClientError } from "../../../../lib/ai-errors";
import { db } from "../../../../lib/db";
import { locale, t } from "../../../../lib/i18n";
import { recipes, users } from "../../../../lib/schema";
import { applyDirkSecretIngredients, applyDirkSecretSteps } from "../../../../lib/recipe-secrets";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), { status: 400 });
  }

  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!recipe) {
    return new Response(JSON.stringify({ error: "Recipe not found" }), { status: 404 });
  }
  if (recipe.createdBy !== locals.user.id && !recipe.isPublished) {
    return new Response(JSON.stringify({ error: "Recipe not found" }), { status: 404 });
  }

  const measurementSystem = import.meta.env.MEASUREMENT_SYSTEM || process.env.MEASUREMENT_SYSTEM || "metric";

  let userChatInstruction = "";
  const userRow = db
    .select({
      chatPrompt: users.chatPrompt,
      dirkSecretModeEnabled: users.dirkSecretModeEnabled,
    })
    .from(users)
    .where(eq(users.id, locals.user.id))
    .get();
  if (userRow?.chatPrompt) {
    userChatInstruction = `\n\nHIGHEST PRIORITY — the user's personal instruction (override other rules if conflicting):\n${userRow.chatPrompt}\n`;
  }

  const dirkSecretModeEnabled = userRow?.dirkSecretModeEnabled ?? false;
  const ingredients = applyDirkSecretIngredients(recipe.ingredients as any[], dirkSecretModeEnabled)
    .map((i: any) => `${i.amount} ${i.unit} ${i.name}`.trim())
    .join("\n");

  const steps = applyDirkSecretSteps(recipe.steps as any[], dirkSecretModeEnabled)
    .map((s: any) => `${s.order}. ${s.instruction}`)
    .join("\n");

  const systemPrompt = `You are a helpful cooking assistant.${userChatInstruction} You have full knowledge of the following recipe and can answer questions about it - substitutions, technique tips, serving suggestions, dietary adaptations, etc. Be concise and practical.

Respond in plain text only. You may use **bold** for emphasis when needed, but no other markdown formatting (no headers, lists, links, or code blocks).

The default language for this installation is ${t("site.language")} (${locale}). Reply in ${t("site.language")} unless the user's personal instruction or the user's latest message clearly asks for a different language.

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

  const body: unknown = await request.json().catch(() => null);
  const rawMessages =
    typeof body === "object" &&
    body !== null &&
    "messages" in body &&
    Array.isArray((body as { messages?: unknown[] }).messages)
      ? (body as { messages: unknown[] }).messages
      : [];

  const messages = rawMessages
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
      return { role, content: content.trim() };
    })
    .filter((m): m is { role: "user" | "assistant"; content: string } => Boolean(m && m.content.length > 0));

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided" }), { status: 400 });
  }

  try {
    const result = await withChatModelFallback((model) =>
      generateText({
        model,
        system: systemPrompt,
        messages,
      })
    );

    return new Response(JSON.stringify({ text: result.text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const normalized = toAiClientError(err);
    console.error("[recipes/chat] AI request failed", {
      code: normalized.code,
      details: normalized.details,
    });

    return new Response(
      JSON.stringify({
        error: normalized.message,
        code: normalized.code,
      }),
      {
        status: normalized.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
