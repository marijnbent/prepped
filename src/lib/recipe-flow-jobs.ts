import type { RecipeFlow } from "./recipe-flow";

export class RecipeFlowBusyError extends Error {}

const pending = new Map<string, Promise<RecipeFlow>>();

export function runRecipeFlowJob(key: string, generate: () => Promise<RecipeFlow>) {
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 3) throw new RecipeFlowBusyError("Recipe flow queue is full");
  const job = Promise.resolve().then(generate).finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
