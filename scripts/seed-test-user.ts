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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const now = Math.floor(Date.now() / 1000);
const hashedPassword = hashPassword("test1234");

// --- Users ---

interface SeedUser {
  id: string;
  name: string;
  email: string;
}

const usersData: SeedUser[] = [
  { id: generateId(), name: "Test Chef", email: "chef@test.com" },
  { id: generateId(), name: "Maria", email: "maria@test.com" },
  { id: generateId(), name: "James", email: "james@test.com" },
];

const insertUser = sqlite.prepare(`
  INSERT OR IGNORE INTO users (id, name, email, email_verified, image, created_at, updated_at)
  VALUES (?, ?, ?, 1, NULL, ?, ?)
`);
const insertAccount = sqlite.prepare(`
  INSERT OR IGNORE INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
  VALUES (?, ?, 'credential', ?, ?, ?, ?)
`);

for (const u of usersData) {
  insertUser.run(u.id, u.name, u.email, now, now);
  insertAccount.run(generateId(), u.id, u.id, hashedPassword, now, now);
  console.log(`Created user: ${u.name} (${u.email} / test1234)`);
}

const [chef, maria, james] = usersData;

// --- Tags ---

const tagNames = [
  "Pasta", "Vegetarian", "Comfort Food", "Quick", "Healthy",
  "Spicy", "Baking", "Breakfast", "Salad", "Drinks",
];

const insertTag = sqlite.prepare(`
  INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)
`);

for (const name of tagNames) {
  insertTag.run(name, slugify(name));
}

// Build tag lookup
const tagLookup: Record<string, number> = {};
for (const name of tagNames) {
  const row = sqlite.prepare("SELECT id FROM tags WHERE slug = ?").get(slugify(name)) as any;
  if (row) tagLookup[slugify(name)] = row.id;
}

function tagIds(...slugs: string[]): number[] {
  return slugs.map((s) => tagLookup[s]).filter(Boolean);
}

// --- Collections (per user) ---

const defaultCollections = [
  "🍽️ Mains", "🥗 Salads", "🍰 Desserts", "🥣 Soups", "🍳 Breakfast",
  "🥪 Snacks", "🥤 Drinks", "🫙 Sauces", "🥖 Sides", "🍪 Baking",
];

const insertCollection = sqlite.prepare(`
  INSERT OR IGNORE INTO collections (name, slug, created_by, sort_order, created_at, updated_at)
  VALUES (?, ?, ?, 0, ?, ?)
`);

for (const u of usersData) {
  for (const name of defaultCollections) {
    insertCollection.run(name, slugify(name), u.id, now, now);
  }
}
console.log("Created default collections for all users");

// Build collection lookup per user
function getCollectionId(userId: string, slug: string): number | undefined {
  const row = sqlite.prepare(
    "SELECT id FROM collections WHERE slug = ? AND created_by = ?"
  ).get(slug, userId) as any;
  return row?.id;
}

// --- Recipes ---

interface SeedRecipe {
  title: string;
  slug: string;
  description: string;
  ingredients: string;
  steps: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  difficulty: string;
  notes?: string;
  sourceUrl?: string;
  userId: string;
  tags: string[];
  collectionSlug?: string;
}

const recipes: SeedRecipe[] = [
  // --- Chef's recipes (5) ---
  {
    title: "Classic Carbonara",
    slug: "classic-carbonara",
    description: "A rich and creamy Roman pasta made with eggs, pecorino, guanciale, and black pepper.",
    ingredients: JSON.stringify([
      { amount: "400", unit: "g", name: "spaghetti" },
      { amount: "200", unit: "g", name: "guanciale" },
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
    userId: chef.id,
    tags: ["pasta", "comfort-food"],
    collectionSlug: "mains",
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
    userId: chef.id,
    tags: ["quick", "spicy"],
    collectionSlug: "mains",
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
    userId: chef.id,
    tags: ["vegetarian", "comfort-food", "healthy"],
    collectionSlug: "soups",
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
    userId: chef.id,
    tags: ["baking"],
    collectionSlug: "desserts",
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
    userId: chef.id,
    tags: ["vegetarian", "baking"],
    collectionSlug: "baking",
  },

  // --- Maria's recipes (4) ---
  {
    title: "Greek Salad",
    slug: "greek-salad",
    description: "Crisp vegetables, briny olives, and creamy feta in a simple lemon-oregano dressing.",
    ingredients: JSON.stringify([
      { amount: "4", unit: "", name: "large tomatoes, cut into wedges" },
      { amount: "1", unit: "", name: "cucumber, sliced" },
      { amount: "1", unit: "", name: "red onion, thinly sliced" },
      { amount: "150", unit: "g", name: "kalamata olives" },
      { amount: "200", unit: "g", name: "feta cheese, block" },
      { amount: "3", unit: "tbsp", name: "extra virgin olive oil" },
      { amount: "1", unit: "tbsp", name: "red wine vinegar" },
      { amount: "1", unit: "tsp", name: "dried oregano" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Cut tomatoes into wedges, slice cucumber and red onion." },
      { order: 2, instruction: "Arrange vegetables on a plate. Scatter olives on top." },
      { order: 3, instruction: "Place the feta block in the center." },
      { order: 4, instruction: "Drizzle with olive oil and vinegar, sprinkle with oregano." },
    ]),
    servings: 4,
    prepTime: 10,
    cookTime: 0,
    difficulty: "easy",
    userId: maria.id,
    tags: ["vegetarian", "healthy", "salad", "quick"],
    collectionSlug: "salads",
  },
  {
    title: "Banana Pancakes",
    slug: "banana-pancakes",
    description: "Fluffy weekend pancakes with caramelized banana and maple syrup.",
    ingredients: JSON.stringify([
      { amount: "200", unit: "g", name: "flour" },
      { amount: "2", unit: "tsp", name: "baking powder" },
      { amount: "1", unit: "tbsp", name: "sugar" },
      { amount: "1", unit: "", name: "egg" },
      { amount: "250", unit: "ml", name: "milk" },
      { amount: "2", unit: "", name: "ripe bananas" },
      { amount: "30", unit: "g", name: "butter" },
      { amount: "", unit: "", name: "maple syrup, to serve" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Mix flour, baking powder, and sugar in a bowl." },
      { order: 2, instruction: "Whisk egg and milk together, then stir into dry ingredients until just combined." },
      { order: 3, instruction: "Mash one banana and fold into the batter." },
      { order: 4, instruction: "Heat butter in a pan over medium heat. Pour small ladlefuls of batter and cook until bubbles appear.", duration: 3 },
      { order: 5, instruction: "Flip and cook until golden on both sides.", duration: 2 },
      { order: 6, instruction: "Slice remaining banana and serve on top with maple syrup." },
    ]),
    servings: 2,
    prepTime: 5,
    cookTime: 15,
    difficulty: "easy",
    userId: maria.id,
    tags: ["breakfast", "quick"],
    collectionSlug: "breakfast",
  },
  {
    title: "Mango Lassi",
    slug: "mango-lassi",
    description: "Cool and creamy Indian yogurt drink with mango and cardamom.",
    ingredients: JSON.stringify([
      { amount: "1", unit: "", name: "large ripe mango, peeled and cubed" },
      { amount: "200", unit: "ml", name: "plain yogurt" },
      { amount: "100", unit: "ml", name: "cold milk" },
      { amount: "2", unit: "tbsp", name: "honey or sugar" },
      { amount: "1/4", unit: "tsp", name: "ground cardamom" },
      { amount: "", unit: "", name: "ice cubes" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Add mango, yogurt, milk, honey, and cardamom to a blender." },
      { order: 2, instruction: "Blend until completely smooth.", duration: 1 },
      { order: 3, instruction: "Add ice cubes and blend briefly." },
      { order: 4, instruction: "Pour into glasses and serve immediately." },
    ]),
    servings: 2,
    prepTime: 5,
    cookTime: 0,
    difficulty: "easy",
    userId: maria.id,
    tags: ["drinks", "quick", "vegetarian"],
    collectionSlug: "drinks",
  },
  {
    title: "Shakshuka",
    slug: "shakshuka",
    description: "Eggs poached in a spiced tomato and pepper sauce — a one-pan breakfast classic.",
    ingredients: JSON.stringify([
      { amount: "2", unit: "tbsp", name: "olive oil" },
      { amount: "1", unit: "", name: "onion, diced" },
      { amount: "1", unit: "", name: "red bell pepper, diced" },
      { amount: "3", unit: "cloves", name: "garlic, minced" },
      { amount: "1", unit: "tsp", name: "cumin" },
      { amount: "1", unit: "tsp", name: "paprika" },
      { amount: "1/2", unit: "tsp", name: "chili flakes" },
      { amount: "400", unit: "g", name: "canned crushed tomatoes" },
      { amount: "4", unit: "", name: "eggs" },
      { amount: "", unit: "", name: "fresh parsley and crusty bread, to serve" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Heat olive oil in a deep skillet. Sauté onion and bell pepper until soft.", duration: 5 },
      { order: 2, instruction: "Add garlic, cumin, paprika, and chili flakes. Cook for 1 minute.", duration: 1 },
      { order: 3, instruction: "Pour in crushed tomatoes, season with salt and pepper. Simmer until thickened.", duration: 10 },
      { order: 4, instruction: "Make 4 wells in the sauce and crack an egg into each." },
      { order: 5, instruction: "Cover and cook until egg whites are set but yolks are still runny.", duration: 5 },
      { order: 6, instruction: "Sprinkle with parsley and serve with crusty bread." },
    ]),
    servings: 2,
    prepTime: 10,
    cookTime: 20,
    difficulty: "easy",
    notes: "Add crumbled feta on top for extra richness.",
    userId: maria.id,
    tags: ["breakfast", "vegetarian", "spicy"],
    collectionSlug: "breakfast",
  },

  // --- James's recipes (3) ---
  {
    title: "Smash Burger",
    slug: "smash-burger",
    description: "Crispy-edged, juicy diner-style burgers with melted cheese and special sauce.",
    ingredients: JSON.stringify([
      { amount: "400", unit: "g", name: "ground beef (80/20)" },
      { amount: "4", unit: "", name: "brioche buns" },
      { amount: "4", unit: "slices", name: "American cheese" },
      { amount: "", unit: "", name: "salt and pepper" },
      { amount: "", unit: "", name: "pickles, lettuce, onion" },
      { amount: "2", unit: "tbsp", name: "mayonnaise", group: "Special sauce" },
      { amount: "1", unit: "tbsp", name: "ketchup", group: "Special sauce" },
      { amount: "1", unit: "tsp", name: "pickle relish", group: "Special sauce" },
      { amount: "1/2", unit: "tsp", name: "garlic powder", group: "Special sauce" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Mix special sauce ingredients in a small bowl." },
      { order: 2, instruction: "Divide beef into 4 balls. Season generously with salt and pepper." },
      { order: 3, instruction: "Heat a cast iron skillet over high heat until smoking." },
      { order: 4, instruction: "Place balls on the skillet and smash flat with a sturdy spatula.", duration: 3 },
      { order: 5, instruction: "Flip when edges are deeply browned. Add cheese, cover briefly to melt.", duration: 2 },
      { order: 6, instruction: "Toast buns in the pan drippings. Assemble with sauce, pickles, lettuce, and onion." },
    ]),
    servings: 4,
    prepTime: 10,
    cookTime: 10,
    difficulty: "easy",
    notes: "The key is a ripping hot skillet — don't be afraid of the smoke.",
    userId: james.id,
    tags: ["quick", "comfort-food"],
    collectionSlug: "mains",
  },
  {
    title: "Overnight Oats",
    slug: "overnight-oats",
    description: "No-cook meal prep breakfast with oats, yogurt, and fresh fruit.",
    ingredients: JSON.stringify([
      { amount: "80", unit: "g", name: "rolled oats" },
      { amount: "120", unit: "ml", name: "milk" },
      { amount: "80", unit: "g", name: "Greek yogurt" },
      { amount: "1", unit: "tbsp", name: "chia seeds" },
      { amount: "1", unit: "tbsp", name: "honey or maple syrup" },
      { amount: "", unit: "", name: "fresh berries and nuts, to top" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Combine oats, milk, yogurt, chia seeds, and honey in a jar." },
      { order: 2, instruction: "Stir well, cover, and refrigerate overnight or at least 4 hours." },
      { order: 3, instruction: "Top with fresh berries and nuts before serving." },
    ]),
    servings: 1,
    prepTime: 5,
    cookTime: 0,
    difficulty: "easy",
    userId: james.id,
    tags: ["breakfast", "healthy", "quick"],
    collectionSlug: "breakfast",
  },
  {
    title: "Spicy Peanut Noodles",
    slug: "spicy-peanut-noodles",
    description: "Quick weeknight noodles tossed in a rich peanut-chili sauce.",
    ingredients: JSON.stringify([
      { amount: "250", unit: "g", name: "noodles (egg or rice)" },
      { amount: "3", unit: "tbsp", name: "peanut butter" },
      { amount: "2", unit: "tbsp", name: "soy sauce" },
      { amount: "1", unit: "tbsp", name: "rice vinegar" },
      { amount: "1", unit: "tbsp", name: "sesame oil" },
      { amount: "1", unit: "tbsp", name: "chili crisp or sriracha" },
      { amount: "1", unit: "clove", name: "garlic, minced" },
      { amount: "", unit: "", name: "chopped peanuts, scallions, and lime, to garnish" },
    ]),
    steps: JSON.stringify([
      { order: 1, instruction: "Cook noodles according to package directions. Drain and rinse with cold water.", duration: 8 },
      { order: 2, instruction: "Whisk together peanut butter, soy sauce, rice vinegar, sesame oil, chili crisp, and garlic." },
      { order: 3, instruction: "Toss noodles with the sauce until evenly coated." },
      { order: 4, instruction: "Serve topped with chopped peanuts, scallions, and a squeeze of lime." },
    ]),
    servings: 2,
    prepTime: 5,
    cookTime: 10,
    difficulty: "easy",
    notes: "Add shredded chicken or crispy tofu for protein.",
    userId: james.id,
    tags: ["quick", "spicy", "vegetarian"],
    collectionSlug: "mains",
  },
];

// --- Insert recipes ---

const insertRecipe = sqlite.prepare(`
  INSERT INTO recipes (title, slug, description, ingredients, steps, servings, prep_time, cook_time, difficulty, is_published, source_url, created_by, created_at, updated_at, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
`);
const insertRecipeTag = sqlite.prepare("INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)");
const insertRecipeCol = sqlite.prepare("INSERT OR IGNORE INTO recipe_collections (recipe_id, collection_id) VALUES (?, ?)");

const recipeIdMap: Record<string, number> = {};

for (const r of recipes) {
  const result = insertRecipe.run(
    r.title, r.slug, r.description, r.ingredients, r.steps,
    r.servings, r.prepTime, r.cookTime, r.difficulty,
    r.sourceUrl || null, r.userId, now, now, r.notes || null,
  );
  const recipeId = Number(result.lastInsertRowid);
  recipeIdMap[`${r.userId}:${r.slug}`] = recipeId;

  for (const tagSlug of r.tags) {
    const tid = tagLookup[tagSlug];
    if (tid) insertRecipeTag.run(recipeId, tid);
  }

  if (r.collectionSlug) {
    const colId = getCollectionId(r.userId, r.collectionSlug);
    if (colId) insertRecipeCol.run(recipeId, colId);
  }

  console.log(`  Created recipe: ${r.title} (by ${usersData.find((u) => u.id === r.userId)!.name})`);
}

// --- Cross-user forks ---

const forks = [
  // Maria forked Chef's carbonara
  { sourceUser: chef.id, sourceSlug: "classic-carbonara", forkUser: maria.id, forkSlug: "classic-carbonara" },
  // James forked Maria's shakshuka
  { sourceUser: maria.id, sourceSlug: "shakshuka", forkUser: james.id, forkSlug: "shakshuka" },
];

const insertFork = sqlite.prepare(`
  INSERT INTO recipes (title, slug, description, ingredients, steps, servings, prep_time, cook_time, difficulty, is_published, source_url, copied_from, created_by, created_at, updated_at, notes)
  SELECT title, ?, description, ingredients, steps, servings, prep_time, cook_time, difficulty, 1, source_url, id, ?, ?, ?, notes
  FROM recipes WHERE id = ?
`);

for (const f of forks) {
  const sourceId = recipeIdMap[`${f.sourceUser}:${f.sourceSlug}`];
  if (!sourceId) continue;
  const result = insertFork.run(f.forkSlug, f.forkUser, now, now, sourceId);
  const forkId = Number(result.lastInsertRowid);
  recipeIdMap[`${f.forkUser}:${f.forkSlug}`] = forkId;

  // Copy tags from source
  const sourceTags = sqlite.prepare("SELECT tag_id FROM recipe_tags WHERE recipe_id = ?").all(sourceId) as any[];
  for (const row of sourceTags) {
    insertRecipeTag.run(forkId, row.tag_id);
  }

  const sourceRecipe = sqlite.prepare("SELECT title FROM recipes WHERE id = ?").get(sourceId) as any;
  const forkUserData = usersData.find((u) => u.id === f.forkUser)!;
  console.log(`  Forked: ${sourceRecipe.title} → ${forkUserData.name}`);
}

// --- Cook logs ---

const insertCookLog = sqlite.prepare(`
  INSERT INTO cook_logs (recipe_id, notes, rating, cooked_at, created_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const cookLogs = [
  {
    userId: chef.id,
    recipeSlug: "classic-carbonara",
    notes: "Nailed the timing on the egg mixture this time. Creamiest batch yet.",
    rating: 5,
    daysAgo: 3,
  },
  {
    userId: chef.id,
    recipeSlug: "thai-green-curry",
    notes: "Used extra curry paste. Great heat level.",
    rating: 4,
    daysAgo: 7,
  },
  {
    userId: maria.id,
    recipeSlug: "shakshuka",
    notes: "Added feta on top — highly recommend. Yolks were perfectly runny.",
    rating: 5,
    daysAgo: 1,
  },
  {
    userId: maria.id,
    recipeSlug: "banana-pancakes",
    notes: "Kids loved these. Used chocolate chips instead of plain banana on top.",
    rating: 4,
    daysAgo: 5,
  },
  {
    userId: james.id,
    recipeSlug: "smash-burger",
    notes: "Best burgers I've made. Cast iron was key.",
    rating: 5,
    daysAgo: 2,
  },
  {
    userId: james.id,
    recipeSlug: "spicy-peanut-noodles",
    notes: "Quick and easy. Added crispy tofu.",
    rating: 4,
    daysAgo: 4,
  },
];

for (const log of cookLogs) {
  const recipeId = recipeIdMap[`${log.userId}:${log.recipeSlug}`];
  if (!recipeId) continue;
  const cookedAt = now - log.daysAgo * 86400;
  insertCookLog.run(recipeId, log.notes, log.rating, cookedAt, log.userId, cookedAt);
}
console.log(`Created ${cookLogs.length} cook logs`);

// --- Done ---

console.log("\nSeed complete! Login credentials:");
for (const u of usersData) {
  console.log(`  ${u.email} / test1234`);
}
sqlite.close();
