import type { RecipeFlow } from "./recipe-flow";

const pending = new Map<string, Promise<RecipeFlow>>();
const waiting: Array<() => void> = [];
let active = 0;

export function isRecipeFlowPending(key: string) {
  return pending.has(key);
}

function drain() {
  while (active < 3 && waiting.length) waiting.shift()!();
}

export function runRecipeFlowJob(key: string, generate: () => Promise<RecipeFlow>) {
  const existing = pending.get(key);
  if (existing) return existing;
  const job = new Promise<RecipeFlow>((resolve, reject) => {
    waiting.push(() => {
      active++;
      Promise.resolve().then(generate).finally(() => {
        active--;
        pending.delete(key);
        drain();
      }).then(resolve, reject);
    });
  });
  pending.set(key, job);
  drain();
  return job;
}
