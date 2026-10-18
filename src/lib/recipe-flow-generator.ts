import { z } from "zod";
import { FLOW_MODEL, recipeFlowSchema, validateRecipeFlow, type FlowRecipe, type RecipeFlow } from "./recipe-flow";
import { RECIPE_FLOW_PROMPT, recipeFlowInput } from "./recipe-flow-prompt";

export class RecipeFlowGenerationError extends Error {}

interface GenerationOptions {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof fetch;
}

export async function generateRecipeFlow(recipe: FlowRecipe, options: GenerationOptions) {
  const fetcher = options.fetch ?? fetch;
  const attempts: Array<{ elapsedMs: number; usage: unknown; errors: string[] }> = [];
  let previous: unknown;
  let errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const start = performance.now();
    const response = await fetcher(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json", "X-Title": "Prepped" },
      body: JSON.stringify({
        model: FLOW_MODEL,
        reasoning: { effort: "medium" },
        max_tokens: 10000,
        provider: { require_parameters: true },
        messages: [
          { role: "system", content: RECIPE_FLOW_PROMPT },
          { role: "user", content: JSON.stringify({ recipe: recipeFlowInput(recipe), ...(attempt ? { previous, validationErrors: errors, instruction: "Return a complete corrected graph. Fix every validation error while preserving source text and quantities." } : {}) }) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "recipe_flow", strict: true, schema: z.toJSONSchema(recipeFlowSchema) } },
      }),
    });
    if (!response.ok) throw new RecipeFlowGenerationError(`Recipe flow provider returned ${response.status}`);
    const body = await response.json();
    if (body.error) throw new RecipeFlowGenerationError("Recipe flow provider rejected generation");
    try {
      previous = JSON.parse(body.choices?.[0]?.message?.content ?? "");
      const validation = validateRecipeFlow(recipe, previous);
      errors = validation.errors;
      attempts.push({ elapsedMs: Math.round(performance.now() - start), usage: body.usage, errors });
      if (validation.flow) return { flow: validation.flow as RecipeFlow, attempts };
    } catch {
      errors = ["Return valid JSON matching the supplied schema"];
      attempts.push({ elapsedMs: Math.round(performance.now() - start), usage: body.usage, errors });
    }
  }
  throw new RecipeFlowGenerationError(`Recipe flow could not be verified: ${errors.join("; ")}`);
}
