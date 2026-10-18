import { z } from "zod";
import type { Ingredient, Step } from "./schema";

export interface FlowRecipe {
  title: string;
  ingredients: Ingredient[];
  steps: Step[];
  servings: number | null;
}

export const FLOW_VERSION = 2;
export const FLOW_MODEL = "~openai/gpt-luna-latest";

export const recipeFlowSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().regex(/^n[1-9]\d*$/),
    label: z.string().min(1).max(80),
    sourceStep: z.number().int().positive(),
    sourceText: z.string().min(1),
    kind: z.enum(["prepare", "combine", "heat", "rest", "finish", "setup"]),
    inputs: z.array(z.object({
      ref: z.string().regex(/^[in][1-9]\d*$/),
      portion: z.string().max(200),
    })).max(50),
    ingredientIds: z.array(z.number().int().positive()).max(50),
  })).min(1).max(100),
  warnings: z.array(z.string().max(500)).max(20),
});

export type RecipeFlow = z.infer<typeof recipeFlowSchema>;
export type FlowNode = RecipeFlow["nodes"][number];

export function validateRecipeFlow(recipe: FlowRecipe, value: unknown) {
  const parsed = recipeFlowSchema.safeParse(value);
  if (!parsed.success) return { flow: null, errors: parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`) };
  const flow = parsed.data;
  const errors: string[] = [];
  const known = new Set(recipe.ingredients.map((_, i) => `i${i + 1}`));
  const usedIngredients = new Set<number>();
  const usedNodes = new Set<string>();
  const sourceCoverage = new Map(recipe.steps.map(step => [step.order, new Uint8Array(step.instruction.length)]));
  for (const node of flow.nodes) {
    if (known.has(node.id)) errors.push(`Duplicate node ${node.id}`);
    for (const input of node.inputs) {
      if (!known.has(input.ref)) errors.push(`${node.id}: unknown or forward input ${input.ref}`);
      if (input.ref.startsWith("n")) usedNodes.add(input.ref);
      if (input.ref.startsWith("i") && !node.ingredientIds.includes(Number(input.ref.slice(1)))) errors.push(`${node.id}: input ${input.ref} missing from ingredientIds`);
    }
    for (const id of node.ingredientIds) {
      if (id > recipe.ingredients.length) errors.push(`${node.id}: unknown ingredient ${id}`);
      usedIngredients.add(id);
    }
    const source = recipe.steps.find(step => step.order === node.sourceStep);
    const start = source?.instruction.indexOf(node.sourceText) ?? -1;
    if (start < 0 || !source) errors.push(`${node.id}: sourceText must be copied exactly from step ${node.sourceStep}`);
    else sourceCoverage.get(source.order)!.fill(1, start, start + node.sourceText.length);
    if (/\b(?:bake|roast|bak|ovenschotel bakken)\b[\s\S]*\b(?:garnish|garneer|bestrooi voor|cool|afkoelen)\b/iu.test(node.sourceText)) {
      errors.push(`${node.id}: split baking from subsequent garnish or cooling into distinct nodes`);
    }
    if (node.inputs.length === 0 && node.kind !== "setup") errors.push(`${node.id}: food action needs ingredient or prepared-food inputs`);
    known.add(node.id);
  }
  for (const [index] of recipe.ingredients.entries()) if (!usedIngredients.has(index + 1)) errors.push(`Ingredient i${index + 1} not accounted for`);
  for (const step of recipe.steps) {
    const coverage = sourceCoverage.get(step.order)!;
    const missing = step.instruction.split("").filter((char, i) => !coverage[i] && /[\p{L}\p{N}]/u.test(char)).join("");
    if (missing) errors.push(`Step ${step.order} has uncovered source text: ${missing.slice(0, 160)}`);
  }
  const terminals = flow.nodes.filter(node => node.kind !== "setup" && !usedNodes.has(node.id));
  if (terminals.length > 1) errors.push(`Disconnected food outputs: ${terminals.map(n => n.id).join(", ")}; connect prepared ingredients to their later actions`);
  return { flow: errors.length ? null : flow, errors };
}
