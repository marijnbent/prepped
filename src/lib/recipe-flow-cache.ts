import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { recipeFlows } from "./schema";
import { validateRecipeFlow, type FlowRecipe, type RecipeFlow } from "./recipe-flow";

export function readRecipeFlow(recipeId: number, fingerprint: string, recipe: FlowRecipe) {
  const row = db.select().from(recipeFlows)
    .where(and(eq(recipeFlows.recipeId, recipeId), eq(recipeFlows.fingerprint, fingerprint))).get();
  if (!row) return null;
  return { ...row, flow: row.flow ? validateRecipeFlow(recipe, row.flow).flow : null };
}

export function saveRecipeFlow(recipeId: number, fingerprint: string, flow: RecipeFlow | null) {
  const values = { recipeId, fingerprint, flow, retryAfter: flow ? null : new Date(Date.now() + 300000), createdAt: new Date() };
  db.insert(recipeFlows).values(values).onConflictDoUpdate({
    target: [recipeFlows.recipeId, recipeFlows.fingerprint],
    set: { flow: values.flow, retryAfter: values.retryAfter, createdAt: values.createdAt },
  }).run();
}
