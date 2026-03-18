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

export interface OrganizedCategory {
  name: string;
  items: { amount: string; unit: string; name: string }[];
}

export interface ShoppingListState {
  items: ShoppingListItem[];
  organized: OrganizedCategory[] | null;
  organizedFor: string | null;
  checked: string[];
}

export function createEmptyShoppingListState(): ShoppingListState {
  return {
    items: [],
    organized: null,
    organizedFor: null,
    checked: [],
  };
}

function normalizeRecipeItem(raw: Record<string, unknown>): RecipeShoppingListItem | null {
  const recipeId = typeof raw.recipeId === "number" ? raw.recipeId : NaN;
  const servings = typeof raw.servings === "number" ? raw.servings : NaN;

  if (!Number.isFinite(recipeId) || !Number.isFinite(servings)) {
    return null;
  }

  return {
    type: "recipe",
    recipeId,
    servings: Math.max(1, Math.round(servings)),
  };
}

function normalizeManualItem(raw: Record<string, unknown>): ManualShoppingListItem | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const amount = typeof raw.amount === "string" ? raw.amount.trim() : "";
  const unit = typeof raw.unit === "string" ? raw.unit.trim() : "";

  if (!id || !name) {
    return null;
  }

  return {
    type: "manual",
    id,
    name,
    amount,
    unit,
  };
}

export function normalizeShoppingListItems(raw: unknown): ShoppingListItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    if (record.type === "manual") {
      const normalized = normalizeManualItem(record);
      return normalized ? [normalized] : [];
    }

    const normalized = normalizeRecipeItem(record);
    return normalized ? [normalized] : [];
  });
}

export function normalizeOrganizedCategories(raw: unknown): OrganizedCategory[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const categories = raw.flatMap((category) => {
    if (!category || typeof category !== "object") {
      return [];
    }

    const record = category as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name || !Array.isArray(record.items)) {
      return [];
    }

    const items = record.items.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const itemRecord = item as Record<string, unknown>;
      const itemName = typeof itemRecord.name === "string" ? itemRecord.name.trim() : "";
      const amount = typeof itemRecord.amount === "string" ? itemRecord.amount.trim() : "";
      const unit = typeof itemRecord.unit === "string" ? itemRecord.unit.trim() : "";

      if (!itemName) {
        return [];
      }

      return [{ name: itemName, amount, unit }];
    });

    return items.length > 0 ? [{ name, items }] : [];
  });

  return categories.length > 0 ? categories : null;
}

export function normalizeCheckedItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item) => {
    if (typeof item !== "string") {
      return [];
    }

    const value = item.trim();
    return value ? [value] : [];
  });
}

export function normalizeShoppingListState(raw: unknown): ShoppingListState {
  if (!raw || typeof raw !== "object") {
    return createEmptyShoppingListState();
  }

  const record = raw as Record<string, unknown>;
  return {
    items: normalizeShoppingListItems(record.items),
    organized: normalizeOrganizedCategories(record.organized),
    organizedFor:
      typeof record.organizedFor === "string" && record.organizedFor.trim()
        ? record.organizedFor
        : null,
    checked: normalizeCheckedItems(record.checked),
  };
}

export function listSignature(items: ShoppingListItem[]): string {
  return [...items]
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }

      if (a.type === "recipe" && b.type === "recipe") {
        return a.recipeId - b.recipeId;
      }

      if (a.type === "manual" && b.type === "manual") {
        return a.id.localeCompare(b.id);
      }

      return 0;
    })
    .map((item) =>
      item.type === "recipe"
        ? `recipe:${item.recipeId}:${item.servings}`
        : `manual:${item.id}:${item.name}:${item.amount}:${item.unit}`
    )
    .join("|");
}
