import { z } from "zod";

export const ingredientSchema = z.object({
  amount: z.string(),
  unit: z.string(),
  name: z.string().min(1),
  group: z.string().optional(),
});

export const stepSchema = z.object({
  order: z.number().int().positive(),
  instruction: z.string().min(1),
  duration: z.number().int().positive().optional(),
});

export const recipeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).min(1),
  servings: z.number().int().positive().optional(),
  prepTime: z.number().int().positive().optional(),
  cookTime: z.number().int().positive().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  imageUrl: z.string().optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(5000).optional(),
  isPublished: z.boolean().optional(),
  tagIds: z.array(z.number()).optional(),
  collectionIds: z.array(z.number()).optional(),
});

export type RecipeInput = z.infer<typeof recipeSchema>;

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
