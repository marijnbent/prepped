const STORAGE_KEY = "prepped-shopping-list";
const ORGANIZED_KEY = "prepped-shopping-organized";
const ORGANIZED_FOR_LIST_KEY = "prepped-shopping-organized-for-list";
const CHECKED_KEY = "prepped-shopping-checked";

export interface ShoppingListItem {
  recipeId: number;
  servings: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getList(): ShoppingListItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveList(list: ShoppingListItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addItem(recipeId: number, defaultServings: number) {
  const list = getList();
  if (list.some((item) => item.recipeId === recipeId)) return;
  list.push({ recipeId, servings: defaultServings });
  saveList(list);
  window.dispatchEvent(new Event("shopping-list-change"));
}

export function removeItem(recipeId: number) {
  const list = getList().filter((item) => item.recipeId !== recipeId);
  saveList(list);
  window.dispatchEvent(new Event("shopping-list-change"));
}

export function updateServings(recipeId: number, servings: number) {
  const list = getList();
  const item = list.find((item) => item.recipeId === recipeId);
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
  return getList().some((item) => item.recipeId === recipeId);
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
