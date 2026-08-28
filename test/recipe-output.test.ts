import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { normalizeRecipeOutput, recipeOutputSchema } from "../src/lib/recipe-output";

type JsonObjectSchema = {
  properties: Record<string, unknown>;
  required: string[];
};

function assertAllPropertiesRequired(schema: JsonObjectSchema) {
  assert.deepEqual(new Set(schema.required), new Set(Object.keys(schema.properties)));
}

test("recipe AI schema requires every structured output property", () => {
  const schema = z.toJSONSchema(recipeOutputSchema) as unknown as JsonObjectSchema & {
    properties: {
      ingredients: { items: JsonObjectSchema };
      steps: { items: JsonObjectSchema };
    };
  };

  assertAllPropertiesRequired(schema);
  assertAllPropertiesRequired(schema.properties.ingredients.items);
  assertAllPropertiesRequired(schema.properties.steps.items);
});

test("normalizes nullable AI values to application optionals", () => {
  const output = recipeOutputSchema.parse({
    title: "Lasagne Wraps",
    description: null,
    ingredients: [{ amount: "", unit: "", name: "wrap", group: null }],
    cookingSupplies: null,
    steps: [{ order: 1, instruction: "Fill the wrap.", duration: null }],
    servings: null,
    prepTime: null,
    cookTime: null,
    difficulty: null,
    notes: null,
    tags: null,
    collections: null,
  });

  assert.deepEqual(normalizeRecipeOutput(output), {
    title: "Lasagne Wraps",
    description: undefined,
    ingredients: [{ amount: "", unit: "", name: "wrap", group: undefined }],
    cookingSupplies: undefined,
    steps: [{ order: 1, instruction: "Fill the wrap.", duration: undefined }],
    servings: undefined,
    prepTime: undefined,
    cookTime: undefined,
    difficulty: undefined,
    notes: undefined,
    tags: undefined,
    collections: undefined,
  });
});
