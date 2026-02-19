import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

// ---- Auth tables (managed by Better Auth) ----

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// ---- App tables ----

export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  ingredients: text("ingredients", { mode: "json" }).notNull().$type<Ingredient[]>(),
  steps: text("steps", { mode: "json" }).notNull().$type<Step[]>(),
  servings: integer("servings"),
  prepTime: integer("prep_time"),
  cookTime: integer("cook_time"),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }),
  imageUrl: text("image_url"),
  sourceUrl: text("source_url"),
  videoUrl: text("video_url"),
  notes: text("notes"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  copiedFrom: integer("copied_from").references(() => recipes.id, { onDelete: "set null" }),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("recipes_slug_created_by_unique").on(table.slug, table.createdBy),
]);

export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("collections_slug_created_by_unique").on(table.slug, table.createdBy),
]);

export const recipeCollections = sqliteTable("recipe_collections", {
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  collectionId: integer("collection_id")
    .notNull()
    .references(() => collections.id, { onDelete: "cascade" }),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const recipeTags = sqliteTable("recipe_tags", {
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

export const cookLogs = sqliteTable("cook_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  rating: integer("rating"),
  cookedAt: integer("cooked_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const favorites = sqliteTable("favorites", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipeId: integer("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("favorites_user_recipe_unique").on(table.userId, table.recipeId),
]);

// ---- Types ----

export interface Ingredient {
  amount: string;
  unit: string;
  name: string;
  group?: string;
}

export interface Step {
  order: number;
  instruction: string;
  duration?: number;
}
