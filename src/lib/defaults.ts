export const defaultCollectionsByLocale = {
  en: [
    "🍽️ Mains",
    "🥗 Salads",
    "🍰 Desserts",
    "🥣 Soups",
    "🍳 Breakfast",
    "🥪 Snacks",
    "🥤 Drinks",
    "🫙 Sauces",
    "🥖 Sides",
    "🍪 Baking",
  ],
  nl: [
    "🍽️ Hoofdgerechten",
    "🥗 Salades",
    "🍰 Nagerechten",
    "🥣 Soepen",
    "🍳 Ontbijt",
    "🥪 Snacks",
    "🥤 Dranken",
    "🫙 Sauzen",
    "🥖 Bijgerechten",
    "🍪 Bakken",
  ],
} as const;

export const defaultCollections = defaultCollectionsByLocale.en;

type DefaultCollectionLocale = keyof typeof defaultCollectionsByLocale;

function normalizeLocale(locale?: string): string {
  if (!locale) return "en";
  return locale.toLowerCase().replace(/_/g, "-").split("-")[0];
}

export function getDefaultCollections(locale?: string): readonly string[] {
  const normalizedLocale = normalizeLocale(locale);
  if (normalizedLocale in defaultCollectionsByLocale) {
    return defaultCollectionsByLocale[normalizedLocale as DefaultCollectionLocale];
  }
  return defaultCollectionsByLocale.en;
}

export const defaultTags = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "quick",
  "healthy",
  "comfort food",
  "spicy",
  "pasta",
  "chicken",
  "beef",
  "fish",
  "seafood",
  "rice",
  "bread",
  "soup",
  "salad",
  "grilling",
  "one-pot",
  "meal prep",
];
