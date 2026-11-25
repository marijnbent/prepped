import { resolveLocale } from "./i18n";

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
  fi: [
    "🍽️ Pääruoat",
    "🥗 Salaatit",
    "🍰 Jälkiruoat",
    "🥣 Keitot",
    "🍳 Aamiainen",
    "🥪 Välipalat",
    "🥤 Juomat",
    "🫙 Kastikkeet",
    "🥖 Lisukkeet",
    "🍪 Leivonta",
  ],
} as const;

export const defaultCollections = defaultCollectionsByLocale.en;

export function getDefaultCollections(locale?: string): readonly string[] {
  return defaultCollectionsByLocale[resolveLocale(locale) ?? "en"];
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
