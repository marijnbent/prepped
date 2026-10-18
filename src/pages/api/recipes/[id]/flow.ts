import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { users } from "../../../../lib/schema";
import { readRecipeFlow } from "../../../../lib/recipe-flow-cache";
import { isRecipeFlowPending } from "../../../../lib/recipe-flow-jobs";
import { prepareRecipeFlow, recipeFlowContext, RecipeFlowError } from "../../../../lib/recipe-flow-service";
import { canReadFlow, isFlowSameOrigin } from "../../../../lib/recipe-flow-access";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}

function context(id: number, userId?: string) {
  const secretMode = userId ? db.select({ enabled: users.dirkSecretModeEnabled }).from(users).where(eq(users.id, userId)).get()?.enabled ?? false : false;
  const current = recipeFlowContext(id, secretMode);
  return current && canReadFlow(current.recipe, userId) ? { ...current, secretMode } : null;
}

export const GET: APIRoute = async ({ params, url, locals }) => {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) return json({ error: "Not found" }, 404);
  const current = context(id, locals.user?.id);
  if (!current) return json({ error: "Not found" }, 404);
  if (url.searchParams.get("fingerprint") !== current.fingerprint) return json({ error: "Recipe changed", code: "RECIPE_CHANGED" }, 409);
  const cached = readRecipeFlow(id, current.fingerprint, current.source);
  if (cached?.flow) return json({ status: "ready", flow: cached.flow, fingerprint: current.fingerprint });
  if (isRecipeFlowPending(`${id}:${current.fingerprint}`)) return json({ status: "pending" });
  if (cached?.retryAfter) return json({ error: "Generation failed", code: "FLOW_UNVERIFIED" }, 502);
  return json({ error: "Recipe flow is unavailable", code: "FLOW_UNAVAILABLE" }, 503);
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
  try {
    const flow = await prepareRecipeFlow(id, current.secretMode);
    const latest = context(id, locals.user.id);
    if (!latest || latest.fingerprint !== current.fingerprint) return json({ error: "Recipe changed", code: "RECIPE_CHANGED" }, 409);
    return json({ status: "ready", flow, fingerprint: current.fingerprint });
  } catch (error) {
    if (error instanceof RecipeFlowError) return json({ error: error.message, code: error.code }, error.status);
    console.error("[recipes/flow] Generation failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Recipe flow is unavailable", code: "FLOW_UNAVAILABLE" }, 503);
  }
};
