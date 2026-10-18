import { createHash } from "node:crypto";
import { FLOW_VERSION, type FlowRecipe } from "./recipe-flow";

export function recipeFlowFingerprint(recipe: FlowRecipe) {
  return createHash("sha256").update(JSON.stringify({
    version: FLOW_VERSION,
    title: recipe.title,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    servings: recipe.servings,
  })).digest("hex");
}
