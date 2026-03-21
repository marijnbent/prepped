import { z } from "zod";
import { db } from "./db";
import { tags, collections, users } from "./schema";
import { eq, and } from "drizzle-orm";
import { slugify } from "./slugify";
import { getDefaultCollections, defaultTags } from "./defaults";
import { locale, t } from "./i18n";
import { isCupboardGroup, sortIngredientsCupboardLast } from "./ingredient-groups";

export const recipeOutputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  ingredients: z.array(
    z.object({
      amount: z.string(),
      unit: z.string(),
      name: z.string(),
      group: z.string().optional(),
    })
  ),
  cookingSupplies: z.array(z.string()).optional(),
  steps: z.array(
    z.object({
      order: z.number(),
      instruction: z.string(),
      duration: z.number().optional(),
    })
  ),
  servings: z.number().optional(),
  prepTime: z.number().optional(),
  cookTime: z.number().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
});

export function resolveTagIds(tagNames: string[]): number[] {
  const ids: number[] = [];
  const normalizedTagNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
  for (const name of normalizedTagNames) {
    const slug = slugify(name);
    if (!slug) continue;
    let existing = db.select().from(tags).where(eq(tags.slug, slug)).get();
    if (!existing) {
      db.insert(tags)
        .values({ name: name.toLowerCase(), slug })
        .onConflictDoNothing()
        .run();
      existing = db.select().from(tags).where(eq(tags.slug, slug)).get();
    }
    if (existing) {
      ids.push(existing.id);
    }
  }
  return ids;
}

export function resolveCollectionIds(collectionNames: string[], userId: string): number[] {
  const ids: number[] = [];
  const normalizedCollectionNames = [...new Set(collectionNames.map((name) => name.trim()).filter(Boolean))];
  for (const name of normalizedCollectionNames) {
    const slug = slugify(name);
    if (!slug) continue;
    let existing = db
      .select()
      .from(collections)
      .where(and(eq(collections.slug, slug), eq(collections.createdBy, userId)))
      .get();
    if (!existing) {
      db
        .insert(collections)
        .values({ name: name.trim(), slug, createdBy: userId })
        .onConflictDoNothing()
        .run();
      existing = db
        .select()
        .from(collections)
        .where(and(eq(collections.slug, slug), eq(collections.createdBy, userId)))
        .get();
    }
    if (existing) {
      ids.push(existing.id);
    }
  }
  return ids;
}

export function getImportContext(userId: string) {
  const existingTags = db.select().from(tags).all();
  const existingCollections = db
    .select()
    .from(collections)
    .where(eq(collections.createdBy, userId))
    .all();
  const existingTagNames = existingTags.map((t) => t.name);
  const existingCollectionNames = existingCollections.map((c) => c.name);
  const defaultCollectionNames = getDefaultCollections(import.meta.env.PUBLIC_UI_LOCALE);

  const userRow = db.select({ importPrompt: users.importPrompt }).from(users).where(eq(users.id, userId)).get();
  const userInstruction = userRow?.importPrompt
    ? `\n\nHIGHEST PRIORITY — the user's personal instruction (override other rules if conflicting):\n${userRow.importPrompt}`
    : "";

  return { existingTagNames, existingCollectionNames, defaultCollectionNames, userInstruction };
}

function buildLocaleInstruction() {
  return `The default language for this installation is ${t("site.language")} (${locale}). Use ${t("site.language")} for all generated recipe text unless the user's personal instruction explicitly says otherwise. This default language rule applies to the title, description, ingredients, ingredient group names, steps, notes, tags, and collections.`;
}

export function buildImportRules(ctx: ReturnType<typeof getImportContext>) {
  return `IMPORTANT RULES:
${buildLocaleInstruction()}
- Convert ALL measurements to metric (grams, ml, liters, celsius). For example:
  - cups of flour → grams (1 cup flour ≈ 125g)
  - cups of sugar → grams (1 cup sugar ≈ 200g)
  - cups of butter → grams (1 cup butter ≈ 227g)
  - cups of liquid → ml (1 cup ≈ 240ml)
  - tablespoons → ml or grams as appropriate (1 tbsp ≈ 15ml)
  - teaspoons → ml (1 tsp ≈ 5ml) — but keep "tsp" for small amounts like spices
  - ounces → grams (1 oz ≈ 28g)
  - pounds → grams (1 lb ≈ 454g)
  - Fahrenheit → Celsius in step instructions (e.g., 350°F → 175°C)
  - inches → cm
- Write the recipe title in ${t("site.language")} by default. Make it simple, descriptive, practical, and easy to scan. Avoid hype, filler, blog-style phrasing, and overlong titles. Keep the title focused on what the dish is, with at most one useful qualifier when needed.
- Write the description in ${t("site.language")} by default. Keep it short and about the dish itself. A little personality is fine, but it should still describe the dish, its flavor, texture, or when you would eat it. Avoid generic praise and avoid text that is not really about the dish.
- Keep ingredient amounts as strings (e.g., "250", "0.5", "a pinch")
- If amounts are given as fractions (like 1/2), convert to decimal (0.5)
- Ingredient names must stay short and clean: just the ingredient itself, with prep or handling details in parentheses when useful (for example: "onion (finely chopped)", "parsley (roughly chopped)"). Do not write ingredient names as full sentences and do not add unnecessary adjectives or duplicate descriptors.
- Extract all preparation steps in order and rewrite them into clear numbered instructions in ${t("site.language")} by default. Each step should be easy to follow at a glance. Split long paragraph-style instructions into smaller chronological steps when that improves clarity. Avoid rambling steps.
- Include any tips, notes, or serving suggestions from the recipe in the "notes" field
- Extract notable cooking supplies into "cookingSupplies" as a plain list of short labels. Include meaningful tools and setup items like baking tray, blender, springform pan, skewers, parchment paper, wire rack, thermometer, or a Dutch oven when they matter to the recipe.
- Omit overly generic basics like "knife", "spoon", "bowl", or "pan" unless the source clearly requires a specific kind, size, or special setup.
- For "to taste" / unquantified ingredients: if you include them, always list each ingredient separately (never combine like "salt and pepper"), leave amount empty, and keep the name clean (just the ingredient, no "to taste" or "naar smaak" suffix).
- Only use the "group" field when the source recipe clearly has separate ingredient sections or components (for example: cake, frosting, sauce, dip, topping). If there is no clear grouping in the source, leave "group" empty. Never invent generic groups like "Main", "Ingredients", or similar.
- Preserve meaningful source component sections when they matter to understanding the recipe. Within each non-cupboard section, put the main ingredients first, then supporting ingredients, then finishing items. Keep the list easy to scan from most important to least important.
- If you use the "${t("recipe.cupboard")}" group, put every "${t("recipe.cupboard")}" ingredient at the end of the ingredients array so those items appear at the bottom.
- Omit salt, pepper, olive oil, and neutral oil when they are used in ordinary background quantities for normal seasoning, frying, greasing, or drizzling.
- Do not omit those pantry staples when the recipe gives a clearly specific measured amount and that amount matters to the recipe structure or outcome. This is especially important for baking and dough-based recipes, where measured salt, oil, or similar staples should usually be kept as real ingredients.
- Include those pantry staples when the amount is clearly substantial or the ingredient is structurally important to the recipe. In that case, treat it as a real ingredient. If it is still a pantry staple rather than a main shopping item, you may group it under "${t("recipe.cupboard")}".
- By default, put dried herbs, dried spices, and similar pantry seasonings in the "${t("recipe.cupboard")}" group. Fresh herbs should usually stay in the main ingredient list unless they are only a tiny garnish.
- For tags: always lowercase (e.g., "cookies", "pasta", "vegetarian"). Prefer existing: [${ctx.existingTagNames.join(", ")}]. Add new ones if needed. Defaults for reference: [${defaultTags.join(", ")}].
- For collections: use Title Case with an emoji prefix. Prefer existing: [${ctx.existingCollectionNames.join(", ")}]. Only create new if nothing fits. Defaults for reference: [${ctx.defaultCollectionNames.join(", ")}].`;
}

const TRAILING_TO_TASTE_RE = /\s*(?:\(|,)?\s*(?:to taste|naar smaak)\)?\s*$/i;
const MULTISPACE_RE = /\s+/g;
const LEADING_TRAILING_PUNCTUATION_RE = /^[,;:.()\s]+|[,;:.()\s]+$/g;
const COMMA_DETAIL_RE = /^([^,]+),\s*([^,]+)$/;

const FRESH_MARKERS = [
  "fresh",
  "verse",
];

const CUPBOARD_EXACT_NAMES = new Set([
  "dried oregano",
  "oregano, dried",
  "dried thyme",
  "thyme, dried",
  "dried rosemary",
  "rosemary, dried",
  "dried basil",
  "basil, dried",
  "dried parsley",
  "parsley, dried",
  "dried dill",
  "dill, dried",
  "bay leaf",
  "bay leaves",
  "paprika",
  "smoked paprika",
  "hot paprika",
  "sweet paprika",
  "cumin",
  "ground cumin",
  "coriander",
  "ground coriander",
  "turmeric",
  "cinnamon",
  "nutmeg",
  "garam masala",
  "curry powder",
  "chili powder",
  "chilli powder",
  "chili flakes",
  "chilli flakes",
  "red pepper flakes",
  "cayenne pepper",
  "garlic powder",
  "onion powder",
  "italian seasoning",
  "mixed spice",
  "gedroogde oregano",
  "gedroogde tijm",
  "gedroogde rozemarijn",
  "gedroogde basilicum",
  "gedroogde peterselie",
  "gedroogde dille",
  "laurierblad",
  "laurierblaadjes",
  "paprikapoeder",
  "gerookt paprikapoeder",
  "komijn",
  "gemalen komijn",
  "koriander",
  "gemalen koriander",
  "kurkuma",
  "kaneel",
  "nootmuskaat",
  "garam masala",
  "kerriepoeder",
  "chilipoeder",
  "chilivlokken",
  "cayennepeper",
  "knoflookpoeder",
  "uienpoeder",
  "italiaanse kruiden",
]);

function normalizeWhitespace(value: string) {
  return value.replace(MULTISPACE_RE, " ").trim();
}

function normalizeIngredientNameValue(name: string) {
  const trimmed = normalizeWhitespace(name).replace(TRAILING_TO_TASTE_RE, "");
  const matchedCommaDetail = !trimmed.includes("(") ? trimmed.match(COMMA_DETAIL_RE) : null;

  if (matchedCommaDetail) {
    const base = normalizeWhitespace(matchedCommaDetail[1]).replace(LEADING_TRAILING_PUNCTUATION_RE, "");
    const detail = normalizeWhitespace(matchedCommaDetail[2]).replace(LEADING_TRAILING_PUNCTUATION_RE, "");
    if (base && detail) {
      return `${base} (${detail})`;
    }
  }

  return trimmed.replace(/\s+,/g, ",").replace(/\s+\)/g, ")").replace(/\(\s+/g, "(").trim();
}

function normalizeGroupValue(group?: string) {
  const normalized = normalizeWhitespace(group || "").replace(LEADING_TRAILING_PUNCTUATION_RE, "");
  return normalized || undefined;
}

function normalizeLookupValue(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[.,;:]/g, " ")
    .replace(MULTISPACE_RE, " ")
    .trim();
}

function hasFreshMarker(name: string) {
  return FRESH_MARKERS.some((marker) => name.includes(marker));
}

function isLikelyCupboardHerbOrSpice(name: string) {
  const normalized = normalizeLookupValue(name);
  if (!normalized || hasFreshMarker(normalized)) {
    return false;
  }

  if (CUPBOARD_EXACT_NAMES.has(normalized)) {
    return true;
  }

  const driedIndicators = ["dried ", "gedroogde "];
  const spiceIndicators = [
    " powder",
    " poeder",
    " flakes",
    " vlokken",
    " seasoning",
    " kruiden",
  ];

  return driedIndicators.some((indicator) => normalized.startsWith(indicator))
    || spiceIndicators.some((indicator) => normalized.endsWith(indicator));
}

export function normalizeImportedIngredients<
  T extends { amount: string; unit: string; name: string; group?: string }
>(ingredients: T[]) {
  const normalized = ingredients.map((ingredient) => {
    const name = normalizeIngredientNameValue(ingredient.name);
    const group = normalizeGroupValue(ingredient.group);
    const shouldUseCupboard = !group && isLikelyCupboardHerbOrSpice(name);

    return {
      ...ingredient,
      amount: normalizeWhitespace(ingredient.amount || ""),
      unit: normalizeWhitespace(ingredient.unit || ""),
      name,
      group: shouldUseCupboard ? t("recipe.cupboard") : group,
    };
  }).filter((ingredient) => ingredient.name);

  return sortIngredientsCupboardLast(normalized);
}
