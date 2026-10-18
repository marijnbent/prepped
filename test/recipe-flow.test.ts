import assert from "node:assert/strict";
import test from "node:test";
import { validateRecipeFlow, type FlowRecipe, type RecipeFlow } from "../src/lib/recipe-flow";
import { recipeFlowFingerprint } from "../src/lib/recipe-flow-fingerprint";
import { generateRecipeFlow, RecipeFlowGenerationError } from "../src/lib/recipe-flow-generator";
import { runRecipeFlowJob } from "../src/lib/recipe-flow-jobs";
import { canReadFlow, isFlowSameOrigin } from "../src/lib/recipe-flow-access";

test("private recipe flows stay with their owner; published flows can be read", () => {
  assert.equal(canReadFlow({ createdBy: "owner", isPublished: false }), false);
  assert.equal(canReadFlow({ createdBy: "owner", isPublished: false }, "other"), false);
  assert.equal(canReadFlow({ createdBy: "owner", isPublished: false }, "owner"), true);
  assert.equal(canReadFlow({ createdBy: "owner", isPublished: true }), true);
});

test("same-origin generation works behind HTTPS proxies and rejects cross-site calls", () => {
  const proxied = new Request("http://prepped.localhost/api/recipes/1/flow", { headers: { origin: "https://prepped.localhost", "x-forwarded-proto": "https", "sec-fetch-site": "same-origin" } });
  assert.equal(isFlowSameOrigin(proxied), true);
  assert.equal(isFlowSameOrigin(new Request(proxied, { headers: { origin: "https://other.example", "x-forwarded-proto": "https" } })), false);
  assert.equal(isFlowSameOrigin(new Request(proxied, { headers: { "sec-fetch-site": "cross-site" } })), false);
});

const recipe: FlowRecipe = {
  title: "Baked potatoes",
  servings: 2,
  ingredients: [{ name: "potatoes", amount: "200", unit: "g" }, { name: "parsley", amount: "5", unit: "g" }],
  steps: [{ order: 1, instruction: "Bake potatoes at 200°C for 30 minutes. Garnish with parsley.", duration: 30 }],
};
const flow: RecipeFlow = {
  nodes: [
    { id: "n1", label: "Bake potatoes", sourceStep: 1, sourceText: "Bake potatoes at 200°C for 30 minutes.", kind: "heat", inputs: [{ ref: "i1", portion: "all" }], ingredientIds: [1] },
    { id: "n2", label: "Garnish", sourceStep: 1, sourceText: "Garnish with parsley.", kind: "finish", inputs: [{ ref: "n1", portion: "all" }, { ref: "i2", portion: "all" }], ingredientIds: [2] },
  ],
  warnings: [],
};

test("accepts complete source-backed actions and rejects changed cooking facts", () => {
  assert.ok(validateRecipeFlow(recipe, flow).flow);
  const changed = structuredClone(flow);
  changed.nodes[0].sourceText = changed.nodes[0].sourceText.replace("200°C", "250°C");
  assert.equal(validateRecipeFlow(recipe, changed).flow, null);
});

test("catches missing sub-actions even when their source step is covered", () => {
  const missing = { ...flow, nodes: flow.nodes.slice(0, 1) };
  const errors = validateRecipeFlow(recipe, missing).errors;
  assert.ok(errors.some(error => error.includes("uncovered source text")));
  assert.ok(errors.some(error => error.includes("Ingredient i2")));
});

test("rejects garnish as an oven input in a combined bake-and-finish action", () => {
  const merged = structuredClone(flow);
  merged.nodes = [{ ...merged.nodes[0], sourceText: recipe.steps[0].instruction, inputs: [{ ref: "i1", portion: "all" }, { ref: "i2", portion: "all" }], ingredientIds: [1, 2] }];
  assert.ok(validateRecipeFlow(recipe, merged).errors.some(error => error.includes("split baking")));
});

test("rejects cycles, dangling preparations, and invented ingredients", () => {
  const cycle = structuredClone(flow);
  cycle.nodes[0].inputs.push({ ref: "n2", portion: "all" });
  assert.ok(validateRecipeFlow(recipe, cycle).errors.some(error => error.includes("forward")));
  const disconnected = structuredClone(flow);
  disconnected.nodes[1].inputs = [{ ref: "i2", portion: "all" }];
  assert.ok(validateRecipeFlow(recipe, disconnected).errors.some(error => error.includes("Disconnected")));
  disconnected.nodes[1].ingredientIds.push(99);
  assert.ok(validateRecipeFlow(recipe, disconnected).errors.some(error => error.includes("unknown ingredient")));
});

test("fingerprints invalidate edited recipes while tolerating top-level property order", () => {
  const original = recipeFlowFingerprint(recipe);
  assert.equal(original, recipeFlowFingerprint({ steps: recipe.steps, ingredients: recipe.ingredients, title: recipe.title, servings: recipe.servings }));
  assert.notEqual(original, recipeFlowFingerprint({ ...recipe, servings: 4 }));
  assert.notEqual(original, recipeFlowFingerprint({ ...recipe, steps: [{ order: 1, instruction: "Different recipe" }] }));
});

test("retries invalid generation once and never accepts an unverified graph", async () => {
  let calls = 0;
  const efforts: string[] = [];
  const broken = { ...flow, nodes: flow.nodes.slice(0, 1) };
  const fakeFetch: typeof fetch = async (_url, options) => {
    calls++;
    efforts.push(JSON.parse(String(options?.body)).reasoning.effort);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(calls === 1 ? broken : flow) } }] }));
  };
  const result = await generateRecipeFlow(recipe, { apiKey: "test", baseUrl: "https://example.invalid", fetch: fakeFetch });
  assert.equal(calls, 2);
  assert.deepEqual(efforts, ["low", "medium"]);
  assert.equal(result.attempts[0].errors.length > 0, true);
  assert.deepEqual(result.flow, flow);
  let invalidCalls = 0;
  await assert.rejects(generateRecipeFlow(recipe, { apiKey: "test", baseUrl: "https://example.invalid", fetch: async () => {
    invalidCalls++;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(broken) } }] }));
  } }), RecipeFlowGenerationError);
  assert.equal(invalidCalls, 2);
});

test("concurrent requests share one generation, and failures release their job", async () => {
  let calls = 0;
  let release!: (flow: RecipeFlow) => void;
  const generate = () => { calls++; return new Promise<RecipeFlow>(resolve => { release = resolve; }); };
  const first = runRecipeFlowJob("test:dedupe", generate);
  const second = runRecipeFlowJob("test:dedupe", generate);
  await Promise.resolve();
  release(flow);
  assert.deepEqual(await first, await second);
  assert.equal(calls, 1);
  await assert.rejects(runRecipeFlowJob("test:failure", async () => { throw new Error("test"); }));
  assert.deepEqual(await runRecipeFlowJob("test:failure", async () => flow), flow);
});
