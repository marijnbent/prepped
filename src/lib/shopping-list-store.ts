import {
  createEmptyShoppingListState,
  normalizeShoppingListState,
  type OrganizedCategory,
  type ShoppingListItem,
  type ShoppingListState,
} from "./shopping-list";

export type {
  ManualShoppingListItem,
  OrganizedCategory,
  RecipeShoppingListItem,
  ShoppingListItem,
  ShoppingListState,
} from "./shopping-list";

let state: ShoppingListState = createEmptyShoppingListState();
let loaded = false;
let loadPromise: Promise<ShoppingListState> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
let saving = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function emitChange() {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new Event("shopping-list-change"));
}

function setState(nextState: ShoppingListState) {
  state = nextState;
  emitChange();
}

function scheduleSave(immediate = false) {
  if (!isBrowser() || !loaded) {
    return;
  }

  dirty = true;

  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }

  if (immediate) {
    void flushSave();
    return;
  }

  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void flushSave();
  }, 250);
}

async function flushSave() {
  if (!isBrowser() || !loaded || saving || !dirty) {
    return;
  }

  dirty = false;
  saving = true;

  try {
    const response = await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      throw new Error(`Failed to save shopping list (${response.status})`);
    }

    const nextState = normalizeShoppingListState(await response.json());
    state = nextState;
  } catch (error) {
    console.error("[shopping-list-store] failed to save", error);
    dirty = true;
  } finally {
    saving = false;
    if (dirty) {
      void flushSave();
    } else {
      emitChange();
    }
  }
}

export function primeShoppingListState(rawState: unknown) {
  loaded = true;
  setState(normalizeShoppingListState(rawState));
}

export async function ensureShoppingListLoaded(): Promise<ShoppingListState> {
  if (!isBrowser()) {
    return state;
  }

  if (loaded) {
    return state;
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const response = await fetch("/api/shopping-list", {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to load shopping list (${response.status})`);
        }

        const nextState = normalizeShoppingListState(await response.json());
        loaded = true;
        setState(nextState);
        return nextState;
      } catch (error) {
        console.error("[shopping-list-store] failed to load", error);
        loaded = true;
        setState(createEmptyShoppingListState());
        return state;
      } finally {
        loadPromise = null;
      }
    })();
  }

  return loadPromise;
}

export function getShoppingListState(): ShoppingListState {
  return state;
}

export function getList(): ShoppingListItem[] {
  return state.items;
}

export function getOrganized(): OrganizedCategory[] | null {
  return state.organized;
}

export function getOrganizedForList(): string | null {
  return state.organizedFor;
}

export function getChecked(): string[] {
  return state.checked;
}

export async function addItem(recipeId: number, defaultServings: number) {
  await ensureShoppingListLoaded();

  if (state.items.some((item) => item.type === "recipe" && item.recipeId === recipeId)) {
    return;
  }

  setState({
    ...state,
    items: [...state.items, { type: "recipe", recipeId, servings: Math.max(1, Math.round(defaultServings)) }],
  });
  scheduleSave();
}

export async function removeItem(recipeId: number) {
  await ensureShoppingListLoaded();

  setState({
    ...state,
    items: state.items.filter((item) => item.type !== "recipe" || item.recipeId !== recipeId),
  });
  scheduleSave();
}

export async function updateServings(recipeId: number, servings: number) {
  await ensureShoppingListLoaded();

  setState({
    ...state,
    items: state.items.map((item) =>
      item.type === "recipe" && item.recipeId === recipeId
        ? { ...item, servings: Math.max(1, Math.round(servings)) }
        : item
    ),
  });
  scheduleSave();
}

export async function clearList() {
  await ensureShoppingListLoaded();

  const nextState = createEmptyShoppingListState();
  setState(nextState);
  dirty = false;

  if (!isBrowser()) {
    return;
  }

  try {
    const response = await fetch("/api/shopping-list", {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to clear shopping list (${response.status})`);
    }

    state = normalizeShoppingListState(await response.json());
    emitChange();
  } catch (error) {
    console.error("[shopping-list-store] failed to clear", error);
    dirty = true;
    scheduleSave(true);
  }
}

export async function isInList(recipeId: number): Promise<boolean> {
  await ensureShoppingListLoaded();

  return state.items.some(
    (item) => item.type === "recipe" && item.recipeId === recipeId
  );
}

export async function addManualItem(name: string, amount = "", unit = "") {
  await ensureShoppingListLoaded();

  const trimmedName = name.trim();
  if (!trimmedName) {
    return;
  }

  setState({
    ...state,
    items: [
      ...state.items,
      {
        type: "manual",
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmedName,
        amount: amount.trim(),
        unit: unit.trim(),
      },
    ],
  });
  scheduleSave();
}

export async function removeManualItem(id: string) {
  await ensureShoppingListLoaded();

  setState({
    ...state,
    items: state.items.filter((item) => item.type !== "manual" || item.id !== id),
  });
  scheduleSave();
}

export function saveOrganized(categories: OrganizedCategory[], listSignature?: string) {
  setState({
    ...state,
    organized: categories,
    organizedFor: listSignature || null,
  });
  scheduleSave(true);
}

export function clearOrganized() {
  setState({
    ...state,
    organized: null,
    organizedFor: null,
  });
  scheduleSave();
}

export function saveChecked(items: string[]) {
  setState({
    ...state,
    checked: [...items],
  });
  scheduleSave();
}

export function clearChecked() {
  setState({
    ...state,
    checked: [],
  });
  scheduleSave();
}
