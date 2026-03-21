import { generateObject } from "ai";
import { and, eq } from "drizzle-orm";
import { withChatModelFallback } from "./ai";
import { toAiClientError } from "./ai-errors";
import { db } from "./db";
import {
  buildImportRules,
  getImportContext,
  normalizeImportedIngredients,
  recipeOutputSchema,
  resolveCollectionIds,
  resolveTagIds,
} from "./import-shared";
import { slugify } from "./slugify";
import { recipeCollections, recipes, recipeTags, type Ingredient, type Step } from "./schema";
import { type ApiRecipeCreateInput, recipeSchema, type RecipeInput } from "./validation";

export class RecipeEnhanceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "RecipeEnhanceError";
    this.status = status;
    this.code = code;
  }
}

function dedupeNumberArray(values: number[] | undefined) {
  return [...new Set(values || [])];
}

function dedupeStringArray(values: string[] | undefined) {
  return [...new Set((values || []).map((value) => value.trim()).filter(Boolean))];
}

function hasLooseDraftFields(input: ApiRecipeCreateInput) {
  return input.ingredients.some((ingredient) => typeof ingredient === "string")
    || input.steps.some((step) => typeof step === "string");
}

function toStructuredIngredient(value: ApiRecipeCreateInput["ingredients"][number]): Ingredient {
  if (typeof value === "string") {
    return { amount: "", unit: "", name: value.trim() };
  }

  return value;
}

function toStructuredStep(value: ApiRecipeCreateInput["steps"][number], index: number): Step {
  if (typeof value === "string") {
    return { order: index + 1, instruction: value.trim() };
  }

  return {
    ...value,
    order: index + 1,
  };
}

function coalesceOptionalString(value: string | undefined) {
  return value?.trim() || undefined;
}

async function enhanceRecipeDraft(input: ApiRecipeCreateInput, userId: string): Promise<RecipeInput> {
  const ctx = getImportContext(userId);
  const importRules = buildImportRules(ctx);

  try {
    const { object } = await withChatModelFallback((model) =>
      generateObject({
        model,
        schema: recipeOutputSchema,
        prompt: `Turn this recipe draft into a clean recipe ready to save.

${importRules}

Additional normalization rules for draft cleanup:
- Preserve the user's intended dish.
- Keep all meaningful ingredients from the draft unless they are exact duplicates or clearly accidental noise.
- Keep ingredient amounts as strings.
- If an ingredient or step is a plain sentence, convert it into clean structured data that matches the house style above.
- Rewrite steps for clarity when helpful, but do not add major new content.
- Extract notable cooking supplies into "cookingSupplies" when they are actually useful.
- Keep notes, tips, and serving suggestions in "notes" when present.
- Prefer existing tags when they fit: [${ctx.existingTagNames.join(", ")}]
- Prefer existing collections when they fit: [${ctx.existingCollectionNames.join(", ")}]
- If the caller already supplied tags or collections, keep them when they make sense.

Structured-data rule:
- If the draft already contains structured data, keep it faithful and normalize it into the same language and style as imported recipes.

Recipe draft JSON:
${JSON.stringify(input).slice(0, 12000)}${ctx.userInstruction}`,
      }),
    );

    return recipeSchema.parse({
      title: object.title,
      description: coalesceOptionalString(object.description),
      ingredients: normalizeImportedIngredients(object.ingredients),
      cookingSupplies: dedupeStringArray(object.cookingSupplies),
      steps: object.steps.map((step, index) => ({
        order: index + 1,
        instruction: step.instruction,
        duration: step.duration,
      })),
      servings: object.servings,
      prepTime: object.prepTime,
      cookTime: object.cookTime,
      difficulty: object.difficulty,
      imageUrl: input.imageUrl,
      imageProvider: input.imageProvider,
      imageAuthorName: input.imageAuthorName,
      imageAuthorUrl: input.imageAuthorUrl,
      imageSourceUrl: input.imageSourceUrl,
      sourceUrl: input.sourceUrl,
      videoUrl: input.videoUrl,
      notes: coalesceOptionalString(input.notes) || coalesceOptionalString(object.notes),
      isPublished: input.isPublished ?? true,
      tagIds: dedupeNumberArray([
        ...(input.tagIds || []),
        ...resolveTagIds([...(input.tags || []), ...(object.tags || [])]),
      ]),
      collectionIds: dedupeNumberArray([
        ...(input.collectionIds || []),
        ...resolveCollectionIds([...(input.collections || []), ...(object.collections || [])], userId),
      ]),
    });
  } catch (error) {
    const normalized = toAiClientError(error);
    throw new RecipeEnhanceError(normalized.message, normalized.status, normalized.code);
  }
}

export async function normalizeRecipeCreateInput(input: ApiRecipeCreateInput, userId: string): Promise<RecipeInput> {
  if (input.aiEnhance) {
    return enhanceRecipeDraft(input, userId);
  }

  if (hasLooseDraftFields(input)) {
    throw new Error("Plain-text ingredients and plain-text steps require aiEnhance: true.");
  }

  return recipeSchema.parse({
    title: input.title,
    description: coalesceOptionalString(input.description),
    ingredients: normalizeImportedIngredients(input.ingredients.map((ingredient) => toStructuredIngredient(ingredient))),
    cookingSupplies: dedupeStringArray(input.cookingSupplies),
    steps: input.steps.map((step, index) => toStructuredStep(step, index)),
    servings: input.servings,
    prepTime: input.prepTime,
    cookTime: input.cookTime,
    difficulty: input.difficulty,
    imageUrl: input.imageUrl,
    imageProvider: input.imageProvider,
    imageAuthorName: input.imageAuthorName,
    imageAuthorUrl: input.imageAuthorUrl,
    imageSourceUrl: input.imageSourceUrl,
    sourceUrl: input.sourceUrl,
    videoUrl: input.videoUrl,
    notes: coalesceOptionalString(input.notes),
    isPublished: input.isPublished ?? true,
    tagIds: dedupeNumberArray([
      ...(input.tagIds || []),
      ...resolveTagIds(input.tags || []),
    ]),
    collectionIds: dedupeNumberArray([
      ...(input.collectionIds || []),
      ...resolveCollectionIds(input.collections || [], userId),
    ]),
  });
}

export function createRecipeForUser(data: RecipeInput, userId: string) {
  let slug = slugify(data.title);

  const existing = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.slug, slug), eq(recipes.createdBy, userId)))
    .get();

  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const tagIds = dedupeNumberArray(data.tagIds);
  const collectionIds = dedupeNumberArray(data.collectionIds);

  return db.transaction((tx) => {
    const recipe = tx
      .insert(recipes)
      .values({
        title: data.title,
        slug,
        description: data.description || null,
        ingredients: data.ingredients,
        cookingSupplies: data.cookingSupplies || null,
        steps: data.steps,
        servings: data.servings || null,
        prepTime: data.prepTime || null,
        cookTime: data.cookTime || null,
        difficulty: data.difficulty || null,
        imageUrl: data.imageUrl || null,
        imageProvider: data.imageProvider || null,
        imageAuthorName: data.imageAuthorName || null,
        imageAuthorUrl: data.imageAuthorUrl || null,
        imageSourceUrl: data.imageSourceUrl || null,
        sourceUrl: data.sourceUrl || null,
        videoUrl: data.videoUrl || null,
        notes: data.notes || null,
        isPublished: data.isPublished ?? true,
        createdBy: userId,
      })
      .returning()
      .get();

    if (tagIds.length > 0) {
      tx.insert(recipeTags)
        .values(tagIds.map((tagId) => ({ recipeId: recipe.id, tagId })))
        .run();
    }

    if (collectionIds.length > 0) {
      tx.insert(recipeCollections)
        .values(collectionIds.map((collectionId) => ({ recipeId: recipe.id, collectionId })))
        .run();
    }

    return recipe;
  });
}
