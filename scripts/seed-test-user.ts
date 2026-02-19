import Database from "better-sqlite3";
import { join } from "path";
import { randomBytes, scryptSync } from "crypto";

const dbPath = join(process.cwd(), "data", "prepped.db");
const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = ON");

// Generate ID like Better Auth does
function generateId() {
  return randomBytes(24).toString("base64url");
}

// Hash password the same way Better Auth does (scrypt)
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const now = Math.floor(Date.now() / 1000);
const userId = generateId();
const accountId = generateId();

// Create user
sqlite.prepare(`
  INSERT INTO users (id, name, email, email_verified, image, created_at, updated_at)
  VALUES (?, ?, ?, ?, NULL, ?, ?)
`).run(userId, "Test Chef", "chef@test.com", 1, now, now);

// Create account with password
sqlite.prepare(`
  INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
  VALUES (?, ?, 'credential', ?, ?, ?, ?)
`).run(accountId, userId, userId, hashPassword("test1234"), now, now);

console.log(`Created user: ${userId} (chef@test.com / test1234)`);

// Seed default collections for the new user
const defaultCollections = [
  "🍽️ Mains", "🥗 Salads", "🍰 Desserts", "🥣 Soups", "🍳 Breakfast",
  "🥪 Snacks", "🥤 Drinks", "🫙 Sauces", "🥖 Sides", "🍪 Baking",
];

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

for (const name of defaultCollections) {
  const slug = slugify(name);
  sqlite.prepare(`
    INSERT OR IGNORE INTO collections (name, slug, created_by, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(name, slug, userId, now, now);
}
console.log("Created default collections");

// Get collection IDs for this user
const mainsCol = sqlite.prepare("SELECT id FROM collections WHERE slug = 'mains' AND created_by = ?").get(userId) as any;
const dessertsCol = sqlite.prepare("SELECT id FROM collections WHERE slug = 'desserts' AND created_by = ?").get(userId) as any;
const soupsCol = sqlite.prepare("SELECT id FROM collections WHERE slug = 'soups' AND created_by = ?").get(userId) as any;
const bakingCol = sqlite.prepare("SELECT id FROM collections WHERE slug = 'baking' AND created_by = ?").get(userId) as any;

// Get some tag IDs
const pastaTag = sqlite.prepare("SELECT id FROM tags WHERE slug = 'pasta'").get() as any;
const vegetarianTag = sqlite.prepare("SELECT id FROM tags WHERE slug = 'vegetarian'").get() as any;
const comfortTag = sqlite.prepare("SELECT id FROM tags WHERE slug = 'comfort-food'").get() as any;
const quickTag = sqlite.prepare("SELECT id FROM tags WHERE slug = 'quick'").get() as any;
const healthyTag = sqlite.prepare("SELECT id FROM tags WHERE slug = 'healthy'").get() as any;

// Insert recipes
const recipes = [
  {
    title: "Classic Carbonara",
    slug: "classic-carbonara",
    description: "A rich and creamy Roman pasta made with eggs, pecorino, guanciale, and black pepper.",
    ingredients: JSON.stringify([
      { amount: "400", unit: "g", name: "spaghetti" },
      { amount: "200", unit: "g", name: "guanciale", group: "" },
      { amount: "4", unit: "", name: "egg yolks" },
      { amount: "2", unit: "", name: "whole eggs" },
      { amount: "100", unit: "g", name: "pecorino romano, finely grated" },
      { amount: "", unit: "", name: "freshly ground black pepper" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Bring a large pot of salted water to a boil. Cook spaghetti until al dente.", duration: 10 },
      { order: 2, instruction: "While pasta cooks, cut guanciale into small strips and cook in a dry pan over medium heat until crispy and golden.", duration: 8 },
      { order: 3, instruction: "In a bowl, whisk together egg yolks, whole eggs, and most of the pecorino. Season generously with black pepper." },
      { order: 4, instruction: "Drain pasta, reserving 1 cup of pasta water. Add pasta to the guanciale pan (off heat)." },
      { order: 5, instruction: "Quickly pour the egg mixture over the hot pasta, tossing vigorously. Add pasta water a splash at a time until creamy." },
      { order: 6, instruction: "Serve immediately with remaining pecorino and more black pepper." },
    ]),
    servings: 4,
    prepTime: 10,
    cookTime: 20,
    difficulty: "medium",
    notes: "The key is to take the pan off the heat before adding the egg mixture to avoid scrambling.",
    tagIds: [pastaTag?.id, comfortTag?.id].filter(Boolean),
    collectionId: mainsCol?.id,
  },
  {
    title: "Thai Green Curry",
    slug: "thai-green-curry",
    description: "Fragrant and spicy Thai curry with coconut milk, vegetables, and fresh basil.",
    ingredients: JSON.stringify([
      { amount: "2", unit: "tbsp", name: "green curry paste" },
      { amount: "400", unit: "ml", name: "coconut milk" },
      { amount: "300", unit: "g", name: "chicken breast, sliced" },
      { amount: "1", unit: "", name: "eggplant, cubed" },
      { amount: "100", unit: "g", name: "green beans, trimmed" },
      { amount: "2", unit: "tbsp", name: "fish sauce" },
      { amount: "1", unit: "tbsp", name: "palm sugar" },
      { amount: "", unit: "", name: "Thai basil leaves" },
      { amount: "", unit: "", name: "jasmine rice, to serve" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Heat a splash of coconut cream in a wok over high heat. Fry curry paste for 1-2 minutes until fragrant.", duration: 2 },
      { order: 2, instruction: "Add chicken and stir-fry until sealed on all sides.", duration: 3 },
      { order: 3, instruction: "Pour in the coconut milk, bring to a simmer. Add eggplant and green beans.", duration: 5 },
      { order: 4, instruction: "Simmer until vegetables are tender and chicken is cooked through.", duration: 10 },
      { order: 5, instruction: "Season with fish sauce and palm sugar. Stir in Thai basil leaves." },
      { order: 6, instruction: "Serve over steamed jasmine rice." },
    ]),
    servings: 4,
    prepTime: 15,
    cookTime: 20,
    difficulty: "easy",
    notes: "Adjust curry paste quantity to your spice preference. Substitute tofu for a vegetarian version.",
    tagIds: [quickTag?.id].filter(Boolean),
    collectionId: mainsCol?.id,
  },
  {
    title: "Tomato Basil Soup",
    slug: "tomato-basil-soup",
    description: "Velvety smooth tomato soup with fresh basil and a touch of cream.",
    ingredients: JSON.stringify([
      { amount: "1", unit: "kg", name: "ripe tomatoes, halved" },
      { amount: "1", unit: "", name: "onion, diced" },
      { amount: "4", unit: "cloves", name: "garlic" },
      { amount: "500", unit: "ml", name: "vegetable broth" },
      { amount: "2", unit: "tbsp", name: "olive oil" },
      { amount: "1", unit: "bunch", name: "fresh basil" },
      { amount: "60", unit: "ml", name: "heavy cream" },
      { amount: "", unit: "", name: "salt and pepper to taste" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Preheat oven to 200°C. Toss tomatoes and garlic with olive oil, salt, and pepper. Roast until caramelized.", duration: 30 },
      { order: 2, instruction: "Sauté onion in a pot until soft and translucent.", duration: 5 },
      { order: 3, instruction: "Add roasted tomatoes, garlic, and broth. Simmer for 15 minutes.", duration: 15 },
      { order: 4, instruction: "Blend until smooth with an immersion blender. Stir in cream and torn basil." },
      { order: 5, instruction: "Season to taste and serve with crusty bread." },
    ]),
    servings: 4,
    prepTime: 10,
    cookTime: 50,
    difficulty: "easy",
    tagIds: [vegetarianTag?.id, comfortTag?.id, healthyTag?.id].filter(Boolean),
    collectionId: soupsCol?.id,
  },
  {
    title: "Chocolate Lava Cake",
    slug: "chocolate-lava-cake",
    description: "Individual chocolate cakes with a molten center — an impressive dessert that's surprisingly simple.",
    ingredients: JSON.stringify([
      { amount: "200", unit: "g", name: "dark chocolate (70%)" },
      { amount: "150", unit: "g", name: "unsalted butter" },
      { amount: "3", unit: "", name: "eggs" },
      { amount: "3", unit: "", name: "egg yolks" },
      { amount: "80", unit: "g", name: "sugar" },
      { amount: "40", unit: "g", name: "flour" },
      { amount: "", unit: "", name: "cocoa powder for dusting" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Preheat oven to 220°C. Butter and dust 4 ramekins with cocoa powder." },
      { order: 2, instruction: "Melt chocolate and butter together in a double boiler. Let cool slightly.", duration: 5 },
      { order: 3, instruction: "Whisk eggs, egg yolks, and sugar until thick and pale.", duration: 3 },
      { order: 4, instruction: "Fold the chocolate mixture into the egg mixture, then gently fold in flour." },
      { order: 5, instruction: "Divide batter among ramekins. Bake until edges are set but centers still jiggle.", duration: 12 },
      { order: 6, instruction: "Let rest 1 minute, then invert onto plates. Serve immediately." },
    ]),
    servings: 4,
    prepTime: 15,
    cookTime: 12,
    difficulty: "medium",
    notes: "You can prepare the batter ahead and refrigerate — just add 2 minutes to baking time.",
    tagIds: [],
    collectionId: dessertsCol?.id,
  },
  {
    title: "Sourdough Focaccia",
    slug: "sourdough-focaccia",
    description: "Pillowy, olive oil-rich focaccia with a crispy crust and airy interior.",
    ingredients: JSON.stringify([
      { amount: "500", unit: "g", name: "bread flour" },
      { amount: "100", unit: "g", name: "active sourdough starter" },
      { amount: "375", unit: "ml", name: "warm water" },
      { amount: "10", unit: "g", name: "salt" },
      { amount: "60", unit: "ml", name: "extra virgin olive oil, plus more for drizzling" },
      { amount: "", unit: "", name: "flaky sea salt" },
      { amount: "", unit: "", name: "fresh rosemary" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Mix flour, starter, water, and salt until a shaggy dough forms. Rest 30 minutes.", duration: 30 },
      { order: 2, instruction: "Perform 4 sets of stretch and folds, 30 minutes apart.", duration: 120 },
      { order: 3, instruction: "Pour olive oil into a baking pan. Transfer dough and gently stretch to fill. Cover and proof 2-4 hours or overnight in fridge." },
      { order: 4, instruction: "Preheat oven to 230°C. Dimple the dough generously with oiled fingers." },
      { order: 5, instruction: "Drizzle with olive oil, scatter rosemary and flaky salt." },
      { order: 6, instruction: "Bake until deeply golden and crispy on the edges.", duration: 25 },
    ]),
    servings: 8,
    prepTime: 30,
    cookTime: 25,
    difficulty: "hard",
    notes: "For best results, do a cold overnight proof in the fridge — it develops more flavor.",
    tagIds: [vegetarianTag?.id].filter(Boolean),
    collectionId: bakingCol?.id,
  },
];

const insertRecipe = sqlite.prepare(`
  INSERT INTO recipes (title, slug, description, ingredients, steps, servings, prep_time, cook_time, difficulty, is_published, created_by, created_at, updated_at, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
`);
const insertRecipeTag = sqlite.prepare("INSERT INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)");
const insertRecipeCol = sqlite.prepare("INSERT INTO recipe_collections (recipe_id, collection_id) VALUES (?, ?)");

for (const r of recipes) {
  const result = insertRecipe.run(
    r.title, r.slug, r.description, r.ingredients, r.steps,
    r.servings, r.prepTime, r.cookTime, r.difficulty,
    userId, now, now, r.notes || null
  );
  const recipeId = result.lastInsertRowid;
  for (const tagId of r.tagIds) {
    insertRecipeTag.run(recipeId, tagId);
  }
  if (r.collectionId) {
    insertRecipeCol.run(recipeId, r.collectionId);
  }
  console.log(`  Created recipe: ${r.title}`);
}

console.log("\nDone! Login with: chef@test.com / test1234");
sqlite.close();
