import { t } from "./i18n";

type IngredientLike = {
  group?: string;
};

const KNOWN_CUPBOARD_GROUPS = new Set(["cupboard", "voorraadkast"]);

export function isCupboardGroup(group?: string | null) {
  const normalized = group?.trim().toLowerCase();
  if (!normalized) return false;

  return KNOWN_CUPBOARD_GROUPS.has(normalized) || normalized === t("recipe.cupboard").trim().toLowerCase();
}

export function sortIngredientsCupboardLast<T extends IngredientLike>(ingredients: T[]) {
  const regular: T[] = [];
  const cupboard: T[] = [];

  for (const ingredient of ingredients) {
    if (isCupboardGroup(ingredient.group)) {
      cupboard.push(ingredient);
    } else {
      regular.push(ingredient);
    }
  }

  return [...regular, ...cupboard];
}

export function groupIngredientsCupboardLast<T extends IngredientLike>(ingredients: T[]) {
  const groups: { group: string; items: T[] }[] = [];
  const indexByGroup = new Map<string, number>();

  for (const ingredient of ingredients) {
    const group = ingredient.group || "";
    const existingIndex = indexByGroup.get(group);

    if (existingIndex === undefined) {
      indexByGroup.set(group, groups.length);
      groups.push({ group, items: [ingredient] });
      continue;
    }

    groups[existingIndex].items.push(ingredient);
  }

  const regularGroups = groups.filter(({ group }) => !isCupboardGroup(group));
  const cupboardGroups = groups.filter(({ group }) => isCupboardGroup(group));

  return [...regularGroups, ...cupboardGroups];
}
