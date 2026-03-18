import { z } from "zod";

function normalizePositiveStepDuration(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.ceil(parsed);
    }

    return value;
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.ceil(value);
  }

  return value;
}

export const ingredientSchema = z.object({
  amount: z.string(),
  unit: z.string(),
  name: z.string().min(1),
  group: z.string().optional(),
});

export const stepSchema = z.object({
  order: z.number().int().positive(),
  instruction: z.string().min(1),
  duration: z.preprocess(normalizePositiveStepDuration, z.number().int().positive().optional()),
});

export const recipeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  ingredients: z.array(ingredientSchema).min(1),
  cookingSupplies: z.array(z.string().min(1).max(200)).optional(),
  steps: z.array(stepSchema).min(1),
  servings: z.number().int().positive().optional(),
  prepTime: z.number().int().positive().optional(),
  cookTime: z.number().int().positive().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  imageUrl: z.string().optional(),
  imageProvider: z.enum(["upload", "unsplash"]).optional(),
  imageAuthorName: z.string().max(200).optional(),
  imageAuthorUrl: z.string().url().optional(),
  imageSourceUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(5000).optional(),
  isPublished: z.boolean().optional(),
  tagIds: z.array(z.number()).optional(),
  collectionIds: z.array(z.number()).optional(),
});

export type RecipeInput = z.infer<typeof recipeSchema>;

export const apiRecipeCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  ingredients: z.array(z.union([ingredientSchema, z.string().min(1).max(500)])).min(1),
  cookingSupplies: z.array(z.string().min(1).max(200)).optional(),
  steps: z.array(z.union([stepSchema, z.string().min(1).max(2000)])).min(1),
  servings: z.number().int().positive().optional(),
  prepTime: z.number().int().positive().optional(),
  cookTime: z.number().int().positive().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  imageUrl: z.string().optional(),
  imageProvider: z.enum(["upload", "unsplash"]).optional(),
  imageAuthorName: z.string().max(200).optional(),
  imageAuthorUrl: z.string().url().optional(),
  imageSourceUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(5000).optional(),
  isPublished: z.boolean().optional(),
  tagIds: z.array(z.number()).optional(),
  collectionIds: z.array(z.number()).optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
  collections: z.array(z.string().min(1).max(200)).optional(),
  aiEnhance: z.boolean().optional(),
});

export type ApiRecipeCreateInput = z.infer<typeof apiRecipeCreateSchema>;

export const cookLogSchema = z.object({
  recipeId: z.number().int().positive(),
  photoUrl: z.string().optional(),
  notes: z.string().max(2000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  cookedAt: z.string().optional(),
});

export type CookLogInput = z.infer<typeof cookLogSchema>;

export const collectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export type CollectionInput = z.infer<typeof collectionSchema>;

export const copyRecipeSchema = z.object({
  recipeId: z.number().int().positive(),
  collectionIds: z.array(z.number()).optional(),
});

export type CopyRecipeInput = z.infer<typeof copyRecipeSchema>;

export const favoriteToggleSchema = z.object({
  recipeId: z.number().int().positive(),
});

export type FavoriteToggleInput = z.infer<typeof favoriteToggleSchema>;
