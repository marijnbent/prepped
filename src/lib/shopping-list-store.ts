const STORAGE_KEY = "prepped-shopping-list";
const ORGANIZED_KEY = "prepped-shopping-organized";
const ORGANIZED_FOR_LIST_KEY = "prepped-shopping-organized-for-list";
const CHECKED_KEY = "prepped-shopping-checked";

export interface RecipeShoppingListItem {
  type: "recipe";
  recipeId: number;
  servings: number;
}

export interface ManualShoppingListItem {
  type: "manual";
  id: string;
  name: string;
  amount: string;
  unit: string;
}

export type ShoppingListItem = RecipeShoppingListItem | ManualShoppingListItem;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function normalizeList(raw: unknown): ShoppingListItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    if ("type" in item && item.type === "manual") {
      const id = typeof item.id === "string" ? item.id : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const amount = typeof item.amount === "string" ? item.amount.trim() : "";
      const unit = typeof item.unit === "string" ? item.unit.trim() : "";

      if (!id || !name) return [];
      return [{ type: "manual", id, name, amount, unit }];
    }

    const recipeId = typeof item.recipeId === "number" ? item.recipeId : NaN;
    const servings = typeof item.servings === "number" ? item.servings : NaN;
    if (!Number.isFinite(recipeId) || !Number.isFinite(servings)) return [];

    return [{ type: "recipe", recipeId, servings }];
  });
}

export function getList(): ShoppingListItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeList(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function saveList(list: ShoppingListItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addItem(recipeId: number, defaultServings: number) {
  const list = getList();
  if (list.some((item) => item.type === "recipe" && item.recipeId === recipeId)) return;
  list.push({ type: "recipe", recipeId, servings: defaultServings });
  saveList(list);
  window.dispatchEvent(new Event("shopping-list-change"));
}

export function removeItem(recipeId: number) {
  const list = getList().filter(
    (item) => item.type !== "recipe" || item.recipeId !== recipeId
  );
  saveList(list);
  window.dispatchEvent(new Event("shopping-list-change"));
}

export function updateServings(recipeId: number, servings: number) {
  const list = getList();
  const item = list.find(
    (entry): entry is RecipeShoppingListItem =>
      entry.type === "recipe" && entry.recipeId === recipeId
  );
  if (item) {
    item.servings = servings;
    saveList(list);
    window.dispatchEvent(new Event("shopping-list-change"));
  }
}

export function clearList() {
  saveList([]);
  clearOrganized();
  clearChecked();
  window.dispatchEvent(new Event("shopping-list-change"));
}

export function isInList(recipeId: number): boolean {
  return getList().some(
    (item) => item.type === "recipe" && item.recipeId === recipeId
  );
}

export function addManualItem(name: string, amount = "", unit = "") {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  const list = getList();
  list.push({
    type: "manual",
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    amount: amount.trim(),
    unit: unit.trim(),
  });
  saveList(list);
  window.dispatchEvent(new Event("shopping-list-change"));
}

export function removeManualItem(id: string) {
  const list = getList().filter(
    (item) => item.type !== "manual" || item.id !== id
  );
  saveList(list);
  window.dispatchEvent(new Event("shopping-list-change"));
}

// --- Organized result persistence ---

export interface OrganizedCategory {
  name: string;
  items: { amount: string; unit: string; name: string }[];
}

export function getOrganized(): OrganizedCategory[] | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(ORGANIZED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOrganized(categories: OrganizedCategory[], listSignature?: string) {
  localStorage.setItem(ORGANIZED_KEY, JSON.stringify(categories));
  if (listSignature) {
    localStorage.setItem(ORGANIZED_FOR_LIST_KEY, listSignature);
  } else {
    localStorage.removeItem(ORGANIZED_FOR_LIST_KEY);
  }
}

export function getOrganizedForList(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ORGANIZED_FOR_LIST_KEY);
}

export function clearOrganized() {
  localStorage.removeItem(ORGANIZED_KEY);
  localStorage.removeItem(ORGANIZED_FOR_LIST_KEY);
}

// --- Checked items persistence ---

export function getChecked(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(CHECKED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChecked(items: string[]) {
  localStorage.setItem(CHECKED_KEY, JSON.stringify(items));
}

export function clearChecked() {
  localStorage.removeItem(CHECKED_KEY);
}
