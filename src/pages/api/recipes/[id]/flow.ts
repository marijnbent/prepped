import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { recipes, users } from "../../../../lib/schema";
import { applyDirkSecretRecipeMode } from "../../../../lib/recipe-secrets";
import { readRecipeFlow, saveRecipeFlow } from "../../../../lib/recipe-flow-cache";
import { recipeFlowFingerprint } from "../../../../lib/recipe-flow-fingerprint";
import { generateRecipeFlow } from "../../../../lib/recipe-flow-generator";
import { runRecipeFlowJob, RecipeFlowBusyError } from "../../../../lib/recipe-flow-jobs";
import { canReadFlow, isFlowSameOrigin } from "../../../../lib/recipe-flow-access";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}

function context(id: number, userId?: string) {
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!recipe || !canReadFlow(recipe, userId)) return null;
  const viewer = userId ? db.select({ enabled: users.dirkSecretModeEnabled }).from(users).where(eq(users.id, userId)).get() : null;
  const transformed = applyDirkSecretRecipeMode({ ingredients: recipe.ingredients, steps: recipe.steps, enabled: viewer?.enabled ?? false });
  const source = { title: recipe.title, ingredients: transformed.ingredients, steps: transformed.steps, servings: recipe.servings };
  return { source, fingerprint: recipeFlowFingerprint(source) };
}

export const GET: APIRoute = async ({ params, url, locals }) => {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) return json({ error: "Not found" }, 404);
  const current = context(id, locals.user?.id);
  if (!current) return json({ error: "Not found" }, 404);
  if (url.searchParams.get("fingerprint") !== current.fingerprint) return json({ error: "Recipe changed", code: "RECIPE_CHANGED" }, 409);
  const cached = readRecipeFlow(id, current.fingerprint, current.source);
  return json(cached?.flow ? { status: "ready", flow: cached.flow, fingerprint: current.fingerprint } : { status: "missing" });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Sign in to generate this view" }, 401);
  if (!isFlowSameOrigin(request)) return json({ error: "Invalid origin" }, 403);
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) return json({ error: "Not found" }, 404);
  const current = context(id, locals.user.id);
  if (!current) return json({ error: "Not found" }, 404);
  const body = await request.json().catch(() => null);
  if (body?.fingerprint !== current.fingerprint) return json({ error: "Recipe changed", code: "RECIPE_CHANGED" }, 409);
  if (current.source.steps.length > 70 || current.source.ingredients.length > 150 || JSON.stringify(current.source).length > 40000) return json({ error: "Recipe too large for this view" }, 422);
  const cached = readRecipeFlow(id, current.fingerprint, current.source);
  if (cached?.flow) return json({ status: "ready", flow: cached.flow, fingerprint: current.fingerprint });
  if (cached?.retryAfter && cached.retryAfter.getTime() > Date.now()) return json({ error: "Try again in a few minutes", code: "FLOW_RETRY_LATER" }, 429);
  const apiKey = (import.meta.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) return json({ error: "Recipe flow is unavailable" }, 503);
  try {
    const flow = await runRecipeFlowJob(`${id}:${current.fingerprint}`, async () => {
      try {
        const result = await generateRecipeFlow(current.source, { apiKey, baseUrl: import.meta.env.OPENROUTER_BASE_URL || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1" });
        const latest = context(id, locals.user!.id);
        if (!latest || latest.fingerprint !== current.fingerprint) throw new Error("RECIPE_CHANGED");
        saveRecipeFlow(id, current.fingerprint, result.flow);
        return result.flow;
      } catch (error) {
        const latest = context(id, locals.user!.id);
        if (latest?.fingerprint === current.fingerprint) saveRecipeFlow(id, current.fingerprint, null);
        throw error;
      }
    });
    const latest = context(id, locals.user.id);
    if (!latest || latest.fingerprint !== current.fingerprint) return json({ error: "Recipe changed", code: "RECIPE_CHANGED" }, 409);
    return json({ status: "ready", flow, fingerprint: current.fingerprint });
  } catch (error) {
    if (error instanceof RecipeFlowBusyError) return json({ error: "Try again shortly", code: "FLOW_BUSY" }, 429);
    if (error instanceof Error && error.message === "RECIPE_CHANGED") return json({ error: "Recipe changed", code: "RECIPE_CHANGED" }, 409);
    console.error("[recipes/flow] Generation did not pass", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "This view could not be verified. Use the original steps and try again later.", code: "FLOW_UNVERIFIED" }, 502);
  }
};
