import { z } from "zod";

// Strict structured outputs require every property to be present. Nullable
// values represent recipe details that are not available in the source.
export const recipeOutputSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  ingredients: z.array(
    z.object({
      amount: z.string(),
      unit: z.string(),
      name: z.string(),
      group: z.string().nullable(),
    })
  ),
  cookingSupplies: z.array(z.string()).nullable(),
  steps: z.array(
    z.object({
      order: z.number(),
      instruction: z.string(),
      duration: z.number().nullable(),
    })
  ),
  servings: z.number().nullable(),
  prepTime: z.number().nullable(),
  cookTime: z.number().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  collections: z.array(z.string()).nullable(),
});

export function normalizeRecipeOutput(output: z.infer<typeof recipeOutputSchema>) {
  return {
    ...output,
    description: output.description ?? undefined,
    ingredients: output.ingredients.map((ingredient) => ({
      ...ingredient,
      group: ingredient.group ?? undefined,
    })),
    cookingSupplies: output.cookingSupplies ?? undefined,
    steps: output.steps.map((step) => ({
      ...step,
      duration: step.duration ?? undefined,
    })),
    servings: output.servings ?? undefined,
    prepTime: output.prepTime ?? undefined,
    cookTime: output.cookTime ?? undefined,
    difficulty: output.difficulty ?? undefined,
    notes: output.notes ?? undefined,
    tags: output.tags ?? undefined,
    collections: output.collections ?? undefined,
  };
}
