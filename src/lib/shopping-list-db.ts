import { eq } from "drizzle-orm";
import { db } from "./db";
import { shoppingLists } from "./schema";
import {
  createEmptyShoppingListState,
  normalizeCheckedItems,
  normalizeOrganizedCategories,
  normalizeShoppingListItems,
  normalizeShoppingListState,
  type ShoppingListState,
} from "./shopping-list";

export function getShoppingListStateForUser(userId: string): ShoppingListState {
  const row = db
    .select({
      items: shoppingLists.items,
      organized: shoppingLists.organized,
      organizedFor: shoppingLists.organizedFor,
      checked: shoppingLists.checked,
    })
    .from(shoppingLists)
    .where(eq(shoppingLists.userId, userId))
    .get();

  if (!row) {
    return createEmptyShoppingListState();
  }

  return normalizeShoppingListState(row);
}

export function saveShoppingListStateForUser(userId: string, rawState: unknown): ShoppingListState {
  const state = normalizeShoppingListState(rawState);
  const now = new Date();

  db.insert(shoppingLists)
    .values({
      userId,
      items: state.items,
      organized: state.organized,
      organizedFor: state.organizedFor,
      checked: state.checked,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: shoppingLists.userId,
      set: {
        items: state.items,
        organized: state.organized,
        organizedFor: state.organizedFor,
        checked: state.checked,
        updatedAt: now,
      },
    })
    .run();

  return state;
}

export function clearShoppingListStateForUser(userId: string): ShoppingListState {
  const state = createEmptyShoppingListState();
  const now = new Date();

  db.insert(shoppingLists)
    .values({
      userId,
      items: state.items,
      organized: state.organized,
      organizedFor: state.organizedFor,
      checked: state.checked,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: shoppingLists.userId,
      set: {
        items: state.items,
        organized: state.organized,
        organizedFor: state.organizedFor,
        checked: state.checked,
        updatedAt: now,
      },
    })
    .run();

  return state;
}

export function saveOrganizedShoppingListForUser(
  userId: string,
  organized: unknown,
  organizedFor: unknown,
  checked: unknown
): ShoppingListState {
  const current = getShoppingListStateForUser(userId);
  const next: ShoppingListState = {
    items: current.items,
    organized: normalizeOrganizedCategories(organized),
    organizedFor:
      typeof organizedFor === "string" && organizedFor.trim() ? organizedFor : null,
    checked: normalizeCheckedItems(checked),
  };

  return saveShoppingListStateForUser(userId, next);
}

export function saveShoppingListItemsForUser(
  userId: string,
  items: unknown,
  checked: unknown
): ShoppingListState {
  const current = getShoppingListStateForUser(userId);
  const next: ShoppingListState = {
    items: normalizeShoppingListItems(items),
    organized: current.organized,
    organizedFor: current.organizedFor,
    checked: normalizeCheckedItems(checked),
  };

  return saveShoppingListStateForUser(userId, next);
}
