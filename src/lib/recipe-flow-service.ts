import { eq } from "drizzle-orm";
import { db } from "./db";
import { recipes } from "./schema";
import { applyDirkSecretRecipeMode } from "./recipe-secrets";
import { readRecipeFlow, saveRecipeFlow } from "./recipe-flow-cache";
import { recipeFlowFingerprint } from "./recipe-flow-fingerprint";
import { generateRecipeFlow } from "./recipe-flow-generator";
import { runRecipeFlowJob } from "./recipe-flow-jobs";

export class RecipeFlowError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

export function recipeFlowContext(id: number, secretMode = false) {
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!recipe) return null;
  const transformed = applyDirkSecretRecipeMode({ ingredients: recipe.ingredients, steps: recipe.steps, enabled: secretMode });
  const source = { title: recipe.title, ...transformed, servings: recipe.servings };
  return { recipe, source, fingerprint: recipeFlowFingerprint(source) };
}

export async function prepareRecipeFlow(id: number, secretMode = false) {
  const current = recipeFlowContext(id, secretMode);
  if (!current) throw new RecipeFlowError("RECIPE_CHANGED", 409);
  const cached = readRecipeFlow(id, current.fingerprint, current.source);
  if (cached?.flow) return cached.flow;
  if (cached?.retryAfter && cached.retryAfter.getTime() > Date.now()) throw new RecipeFlowError("FLOW_RETRY_LATER", 429);
  if (current.source.steps.length > 70 || current.source.ingredients.length > 150 || JSON.stringify(current.source).length > 40000) throw new RecipeFlowError("FLOW_TOO_LARGE", 422);
  const apiKey = (import.meta.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) throw new RecipeFlowError("FLOW_UNAVAILABLE", 503);
  const isCurrent = () => recipeFlowContext(id, secretMode)?.fingerprint === current.fingerprint;
  return runRecipeFlowJob(`${id}:${current.fingerprint}`, async () => {
    if (!isCurrent()) throw new RecipeFlowError("RECIPE_CHANGED", 409);
    try {
      const result = await generateRecipeFlow(current.source, { apiKey, baseUrl: import.meta.env.OPENROUTER_BASE_URL || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1" });
      if (!isCurrent()) throw new RecipeFlowError("RECIPE_CHANGED", 409);
      saveRecipeFlow(id, current.fingerprint, result.flow);
      return result.flow;
    } catch (error) {
      if (isCurrent()) saveRecipeFlow(id, current.fingerprint, null);
      if (error instanceof RecipeFlowError) throw error;
      console.error("[recipes/flow] Generation did not pass", error instanceof Error ? error.name : "UnknownError");
      throw new RecipeFlowError("FLOW_UNVERIFIED", 502);
    }
  });
}

export function scheduleRecipeFlow(id: number, secretMode = false) {
  void prepareRecipeFlow(id, secretMode).catch((error) => {
    if (!(error instanceof RecipeFlowError)) console.error("[recipes/flow] Background generation failed", error instanceof Error ? error.name : "UnknownError");
  });
}
