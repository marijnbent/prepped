import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
  Minus,
  Plus,
  X,
  ClipboardCopy,
  Check,
  Trash2,
  ChevronDown,
  Search,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { scaleAmount } from "@/lib/scale-amount";
import {
  addItem,
  addManualItem,
  clearOrganized,
  clearList,
  ensureShoppingListLoaded,
  getShoppingListState,
  primeShoppingListState,
  removeItem,
  saveChecked,
  saveOrganized,
  updateServings,
  type ManualShoppingListItem,
} from "@/lib/shopping-list-store";
import {
  listSignature,
  parseOrganizedFor,
  serializeOrganizedFor,
  type OrganizedCategory,
  type ShoppingListItem,
  type ShoppingListState,
} from "@/lib/shopping-list";

type OrganizeResponse = {
  categories?: Array<{
    name: string;
    items: Array<{ amount: string; unit: string; name: string; checked?: boolean }>;
  }>;
};

interface Ingredient {
  amount: string;
  unit: string;
  name: string;
  group?: string;
}

interface Recipe {
  id: number;
  title: string;
  slug: string;
  servings: number | null;
  ingredients: Ingredient[];
  imageUrl: string | null;
}

interface Props {
  recipes: Recipe[];
  initialState: ShoppingListState;
}

interface MergedIngredient {
  amount: string;
  unit: string;
  name: string;
}

function mergeIngredients(
  recipes: Recipe[],
  servingsByRecipeId: Map<number, number>,
  manualItems: ManualShoppingListItem[]
): MergedIngredient[] {
  const merged = new Map<string, { amount: number; hasNumeric: boolean; nonNumeric: string[]; unit: string; name: string }>();

  function mergeIngredient(ingredient: Ingredient) {
    const key = `${ingredient.name.toLowerCase()}|${ingredient.unit.toLowerCase()}`;
    const num = parseFloat(ingredient.amount);

    if (!merged.has(key)) {
      merged.set(key, {
        amount: 0,
        hasNumeric: false,
        nonNumeric: [],
        unit: ingredient.unit,
        name: ingredient.name,
      });
    }

    const entry = merged.get(key)!;
    if (!isNaN(num)) {
      entry.amount += num;
      entry.hasNumeric = true;
    } else if (ingredient.amount) {
      entry.nonNumeric.push(ingredient.amount);
    }
  }

  for (const recipe of recipes) {
    const servings = servingsByRecipeId.get(recipe.id);
    if (!servings) continue;

    const defaultServings = recipe.servings || 4;
    const factor = servings / defaultServings;

    for (const ing of recipe.ingredients) {
      const scaledAmount = scaleAmount(ing.amount, factor);
      mergeIngredient({ ...ing, amount: scaledAmount });
    }
  }

  for (const item of manualItems) {
    mergeIngredient({
      amount: item.amount,
      unit: item.unit,
      name: item.name,
    });
  }

  const result: MergedIngredient[] = [];
  for (const entry of merged.values()) {
    let amount: string;
    if (entry.hasNumeric) {
      const rounded = Math.round(entry.amount * 100) / 100;
      amount = rounded === Math.floor(rounded) ? String(rounded) : rounded.toString();
      if (entry.nonNumeric.length > 0) {
        amount += " + " + entry.nonNumeric.join(", ");
      }
    } else {
      amount = entry.nonNumeric.join(", ");
    }
    result.push({ amount, unit: entry.unit, name: entry.name });
  }

  return result;
}

function formatListAsText(
  categories: OrganizedCategory[] | null,
  merged: MergedIngredient[],
  pendingManualItems: ManualShoppingListItem[] = []
): string {
  const lines: string[] = [t("shopping.title"), "=".repeat(t("shopping.title").length), ""];

  if (categories) {
    for (const cat of categories) {
      lines.push(cat.name);
      for (const item of cat.items) {
        const parts = [item.amount, item.unit, item.name].filter(Boolean);
        lines.push(`- ${parts.join(" ")}`);
      }
      lines.push("");
    }

    if (pendingManualItems.length > 0) {
      lines.push(t("shopping.manualLabel"));
      for (const item of pendingManualItems) {
        const parts = [item.amount, item.unit, item.name].filter(Boolean);
        lines.push(`- ${parts.join(" ")}`);
      }
      lines.push("");
    }
  } else {
    for (const item of merged) {
      const parts = [item.amount, item.unit, item.name].filter(Boolean);
      lines.push(`- ${parts.join(" ")}`);
    }
  }

  return lines.join("\n").trim();
}

function formatListAsCheckboxes(
  categories: OrganizedCategory[] | null,
  merged: MergedIngredient[],
  checkedItems: Set<string>,
  pendingManualItems: ManualShoppingListItem[] = []
): string {
  const lines: string[] = [];

  if (categories) {
    for (const cat of categories) {
      lines.push(`## ${cat.name}`);
      cat.items.forEach((item, i) => {
        const key = `${cat.name}-${i}`;
        const checked = checkedItems.has(key);
        const parts = [item.amount, item.unit, item.name].filter(Boolean);
        lines.push(`- [${checked ? "x" : " "}] ${parts.join(" ")}`);
      });
      lines.push("");
    }

    if (pendingManualItems.length > 0) {
      lines.push(`## ${t("shopping.manualLabel")}`);
      pendingManualItems.forEach((item) => {
        const key = `manual-organized-${item.id}`;
        const checked = checkedItems.has(key);
        const parts = [item.amount, item.unit, item.name].filter(Boolean);
        lines.push(`- [${checked ? "x" : " "}] ${parts.join(" ")}`);
      });
      lines.push("");
    }
  } else {
    merged.forEach((item, i) => {
      const key = `merged-${i}`;
      const checked = checkedItems.has(key);
      const parts = [item.amount, item.unit, item.name].filter(Boolean);
      lines.push(`- [${checked ? "x" : " "}] ${parts.join(" ")}`);
    });
  }

  return lines.join("\n").trim();
}

/* Renders the "Customize AI behavior in {link}" hint, splitting on {link} placeholder */
function CustomizeHint() {
  const hint = t("shopping.customizeHint");
  const linkText = t("shopping.profileLink");
  const parts = hint.split("{link}");

  return (
    <p className="text-sm text-muted-foreground">
      {parts[0]}
      <a href="/profile" className="underline underline-offset-4 hover:text-foreground">
        {linkText}
      </a>
      {parts[1]}
    </p>
  );
}

/* ─── Ingredient row — shared between organized and basic views ─── */
function IngredientRow({
  itemKey,
  amount,
  unit,
  name,
  checkedItems,
  toggleCheck,
}: {
  itemKey: string;
  amount: string;
  unit: string;
  name: string;
  checkedItems: Set<string>;
  toggleCheck: (key: string) => void;
}) {
  const checked = checkedItems.has(itemKey);
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => toggleCheck(itemKey)}
        className="group flex w-full items-start gap-3 py-3 text-left"
      >
        <span
          className={`mt-[3px] flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground group-hover:border-foreground"
          }`}
        >
          {checked && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className={checked ? "text-muted-foreground line-through" : ""}>
          {amount && (
            <span className="font-medium tabular-nums">
              {amount}
              {unit && ` ${unit}`}{" "}
            </span>
          )}
          {name}
        </span>
      </button>
    </li>
  );
}

function normalizeIngredientLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function organizedIncludesManualItem(
  categories: OrganizedCategory[],
  item: ManualShoppingListItem
): boolean {
  const manualName = normalizeIngredientLabel(item.name);
  const manualLabel = normalizeIngredientLabel(
    [item.amount, item.unit, item.name].filter(Boolean).join(" ")
  );

  return categories.some((category) =>
    category.items.some((organizedItem) => {
      const organizedName = normalizeIngredientLabel(organizedItem.name);
      if (organizedName === manualName) {
        return true;
      }

      const organizedLabel = normalizeIngredientLabel(
        [organizedItem.amount, organizedItem.unit, organizedItem.name].filter(Boolean).join(" ")
      );
      return organizedLabel === manualLabel;
    })
  );
}

export default function ShoppingListPage({ recipes: allRecipes, initialState }: Props) {
  const [listItems, setListItems] = useState<ShoppingListItem[]>([]);
  const [organized, setOrganized] = useState<OrganizedCategory[] | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(initialState.items.length === 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualName, setManualName] = useState("");
  const [organizeError, setOrganizeError] = useState("");
  const [organizedManualIds, setOrganizedManualIds] = useState<string[] | null>(null);
  const manualNameRef = useRef<HTMLInputElement>(null);

  const initializedRef = useRef(false);
  useEffect(() => {
    function syncFromStore() {
      const currentState = getShoppingListState();
      // Compare only recipe-based signature so manual item changes don't clear organized
      const recipeOnlySig = listSignature(currentState.items.filter((i) => i.type === "recipe"));
      const organizedMeta = parseOrganizedFor(currentState.organizedFor);
      const hasOrganized = !!(
        currentState.organized && organizedMeta.recipeSignature === recipeOnlySig
      );

      setListItems(currentState.items);
      setOrganized(hasOrganized ? currentState.organized : null);
      setOrganizedManualIds(hasOrganized ? organizedMeta.manualItemIds : null);
      setCheckedItems(new Set(currentState.checked));

      if (hasOrganized) {
        organizedForRecipeSig.current = recipeOnlySig;
      } else {
        organizedForRecipeSig.current = null;
      }
    }

    primeShoppingListState(initialState);
    syncFromStore();
    initializedRef.current = true;
    const handler = () => syncFromStore();
    window.addEventListener("shopping-list-change", handler);
    void ensureShoppingListLoaded().then(() => syncFromStore());
    return () => window.removeEventListener("shopping-list-change", handler);
  }, [initialState]);

  const recipeById = useMemo(
    () => new Map(allRecipes.map((recipe) => [recipe.id, recipe])),
    [allRecipes]
  );

  const selectedRecipes = useMemo(
    () =>
      listItems
        .filter(
          (item): item is Extract<ShoppingListItem, { type: "recipe" }> =>
            item.type === "recipe"
        )
        .map((item) => recipeById.get(item.recipeId))
        .filter((r): r is Recipe => !!r),
    [listItems, recipeById]
  );

  const listItemMap = useMemo(
    () =>
      new Map(
        listItems
          .filter(
            (item): item is Extract<ShoppingListItem, { type: "recipe" }> =>
              item.type === "recipe"
          )
          .map((item) => [item.recipeId, item.servings])
      ),
    [listItems]
  );

  const manualItems = useMemo(
    () =>
      listItems.filter(
        (item): item is ManualShoppingListItem => item.type === "manual"
      ),
    [listItems]
  );

  const inListSet = useMemo(
    () =>
      new Set(
        listItems
          .filter(
            (item): item is Extract<ShoppingListItem, { type: "recipe" }> =>
              item.type === "recipe"
          )
          .map((item) => item.recipeId)
      ),
    [listItems]
  );

  const merged = useMemo(
    () => mergeIngredients(selectedRecipes, listItemMap, manualItems),
    [selectedRecipes, listItemMap, manualItems]
  );

  const pendingManualItems = useMemo(() => {
    if (!organized) {
      return [];
    }

    if (organizedManualIds) {
      const includedIds = new Set(organizedManualIds);
      return manualItems.filter((item) => !includedIds.has(item.id));
    }

    return manualItems.filter((item) => !organizedIncludesManualItem(organized, item));
  }, [manualItems, organized, organizedManualIds]);

  // Track the recipe-only signature at the time of the last organize, so manual item
  // additions don't invalidate the organized view.
  const organizedForRecipeSig = useRef<string | null>(null);
  const recipeOnlySignature = useMemo(
    () => listSignature(listItems.filter((i) => i.type === "recipe")),
    [listItems]
  );
  useEffect(() => {
    if (!initializedRef.current) return;
    if (!organized) return;
    if (organizedForRecipeSig.current !== null && organizedForRecipeSig.current !== recipeOnlySignature) {
      setOrganized(null);
      setOrganizedManualIds(null);
      setCheckedItems(new Set());
      saveChecked([]);
      clearOrganized();
      organizedForRecipeSig.current = null;
    }
  }, [recipeOnlySignature, organized]);

  const filteredRecipes = useMemo(() => {
    if (!searchQuery) return allRecipes;
    const q = searchQuery.toLowerCase();
    return allRecipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [allRecipes, searchQuery]);

  async function handleOrganize() {
    if (merged.length === 0) return;
    setOrganizing(true);
    setOrganizeError("");

    // Collect currently checked item names to send to the LLM
    const checkedNames: string[] = [];
    if (organized) {
      for (const cat of organized) {
        cat.items.forEach((item, i) => {
          if (checkedItems.has(`${cat.name}-${i}`)) checkedNames.push(item.name.toLowerCase());
        });
      }
    } else {
      merged.forEach((item, i) => {
        if (checkedItems.has(`merged-${i}`)) checkedNames.push(item.name.toLowerCase());
      });
    }
    pendingManualItems.forEach((item) => {
      if (checkedItems.has(`manual-organized-${item.id}`)) checkedNames.push(item.name.toLowerCase());
    });

    try {
      const res = await fetch("/api/shopping-list/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: merged, checkedNames }),
      });
      const data = await res.json().catch(() => null) as OrganizeResponse | null;
      if (!res.ok) {
        setOrganizeError(getApiErrorMessage(data, t("shopping.organizeError")));
        return;
      }

      if (!Array.isArray(data?.categories) || data.categories.length === 0) {
        setOrganizeError(t("shopping.organizeError"));
        return;
      }

      // Build checked set from the checked field returned by the LLM
      const newChecked = new Set<string>();
      for (const cat of data.categories) {
        cat.items.forEach((item: { name: string; checked?: boolean }, i: number) => {
          if (item.checked) newChecked.add(`${cat.name}-${i}`);
        });
      }
      setOrganized(data.categories);
      setOrganizedManualIds(manualItems.map((item) => item.id));
      setCheckedItems(newChecked);
      saveChecked(Array.from(newChecked));
      saveOrganized(
        data.categories,
        serializeOrganizedFor(recipeOnlySignature ?? undefined, manualItems) ?? undefined,
      );
      organizedForRecipeSig.current = recipeOnlySignature;
    } catch {
      setOrganizeError(t("shopping.organizeError"));
    } finally {
      setOrganizing(false);
    }
  }

  async function handleCopy() {
    const text = formatListAsCheckboxes(organized, merged, checkedItems, pendingManualItems);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }


  async function handleClear() {
    if (confirm(t("shopping.clearConfirm"))) {
      await clearList();
      setOrganized(null);
      setOrganizedManualIds(null);
      setCheckedItems(new Set());
    }
  }

  function toggleCheck(key: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveChecked(Array.from(next));
      return next;
    });
  }

  const hasItems = listItems.length > 0;
  const hasSelectedRecipes = selectedRecipes.length > 0;
  const checkedCount = checkedItems.size;
  const recipeCount = selectedRecipes.length;
  const totalCount = organized
    ? organized.reduce((sum, cat) => sum + cat.items.length, 0) + pendingManualItems.length
    : merged.length;

  async function handleAddManualItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!manualName.trim()) {
      manualNameRef.current?.focus();
      return;
    }

    await addManualItem(manualName);
    setManualName("");
    manualNameRef.current?.focus();
  }

  const sectionTitle = "text-2xl font-medium tracking-tight";
  const countClass = "ml-2 text-base font-normal tracking-normal text-muted-foreground tabular-nums";

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-[-0.04em] leading-none">
          {t("shopping.title")}
          {hasItems && totalCount > 0 && (
            <span className="ml-2 inline-block align-middle text-xl tracking-normal text-muted-foreground tabular-nums">
              {checkedCount}/{totalCount}
            </span>
          )}
        </h1>
        {!hasItems && !hasSelectedRecipes && (
          <div className="mt-8">
            <p className="text-xl font-medium">{t("shopping.empty")}</p>
            <p className="mt-2 text-muted-foreground">{t("shopping.emptyHint")}</p>
          </div>
        )}
      </header>

      <div
        className={
          hasItems
            ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-start lg:gap-x-16"
            : "max-w-2xl"
        }
      >
        {/* ─── The list: add an item, tick things off ─── */}
        <section className="min-w-0 lg:order-2">
          <form onSubmit={handleAddManualItem} className="flex gap-2">
            <label htmlFor="manual-item-name" className="sr-only">
              {t("shopping.manualLabel")}
            </label>
            <Input
              ref={manualNameRef}
              id="manual-item-name"
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder={t("shopping.manualPlaceholder")}
              className="h-12 min-w-0 flex-1 px-5 text-base"
            />
            <Button type="submit" size="lg" className="shrink-0 px-4 sm:px-6">
              <Plus />
              <span className="sr-only sm:not-sr-only">{t("shopping.addManual")}</span>
            </Button>
          </form>

          {hasItems && merged.length > 0 && (
            <div className="mt-12">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <h2 className={sectionTitle}>{t("shopping.ingredients")}</h2>
                <div className="-mr-2 flex items-center">
                  <Button variant="ghost" size="sm" onClick={handleCopy} disabled={merged.length === 0}>
                    {copied ? <Check /> : <ClipboardCopy />}
                    <span role="status">{copied ? t("shopping.copied") : t("shopping.copy")}</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void handleClear()}>
                    <Trash2 />
                    {t("shopping.clear")}
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOrganize}
                  disabled={organizing || merged.length === 0}
                >
                  {organizing ? t("shopping.organizing") : t("shopping.organize")}
                </Button>
                <CustomizeHint />
              </div>
              {organizeError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {organizeError}
                </p>
              )}

              {organized ? (
                <div className="mt-8 space-y-8">
                  {organized.map((category) => {
                    const checkedInCat = category.items.filter(
                      (_, i) => checkedItems.has(`${category.name}-${i}`)
                    ).length;

                    return (
                      <div key={category.name}>
                        <h3 className="font-medium">
                          {category.name}
                          <span className={countClass}>
                            {checkedInCat > 0 ? `${checkedInCat}/` : ""}
                            {category.items.length}
                          </span>
                        </h3>
                        <ul className="mt-2 divide-y divide-border border-t border-border">
                          {category.items.map((item, i) => {
                            const key = `${category.name}-${i}`;
                            return (
                              <IngredientRow
                                key={key}
                                itemKey={key}
                                amount={item.amount}
                                unit={item.unit}
                                name={item.name}
                                checkedItems={checkedItems}
                                toggleCheck={toggleCheck}
                              />
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}

                  {/* Manual items appended at the bottom, unorganized */}
                  {pendingManualItems.length > 0 && (
                    <div>
                      <h3 className="font-medium">
                        {t("shopping.manualLabel")}
                        <span className={countClass}>{pendingManualItems.length}</span>
                      </h3>
                      <ul className="mt-2 divide-y divide-border border-t border-border">
                        {pendingManualItems.map((item) => {
                          const key = `manual-organized-${item.id}`;
                          return (
                            <IngredientRow
                              key={key}
                              itemKey={key}
                              amount={item.amount}
                              unit={item.unit}
                              name={item.name}
                              checkedItems={checkedItems}
                              toggleCheck={toggleCheck}
                            />
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <ul className="mt-6 divide-y divide-border border-t border-border">
                  {merged.map((item, i) => {
                    const key = `merged-${i}`;
                    return (
                      <IngredientRow
                        key={key}
                        itemKey={key}
                        amount={item.amount}
                        unit={item.unit}
                        name={item.name}
                        checkedItems={checkedItems}
                        toggleCheck={toggleCheck}
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* ─── Recipes on the list ─── */}
        <section className="mt-14 min-w-0 lg:order-1 lg:mt-0">
          {hasSelectedRecipes && (
            <div className="mb-8">
              <h2 className={sectionTitle}>
                {t("nav.recipes")}
                <span className={countClass}>{recipeCount}</span>
              </h2>
              <ul className="mt-3 divide-y divide-border border-t border-border">
                {selectedRecipes.map((recipe) => {
                  const servings = listItemMap.get(recipe.id);
                  if (!servings) return null;
                  const imageUrl = recipe.imageUrl
                    ? (recipe.imageUrl.startsWith("/")
                        ? `/api/uploads${recipe.imageUrl}`
                        : recipe.imageUrl)
                    : null;

                  return (
                    <li key={recipe.id} className="flex items-center gap-4 py-4">
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="size-16 shrink-0 rounded-[20px] object-cover" />
                      ) : (
                        <div className="size-16 shrink-0 rounded-[20px] bg-secondary" />
                      )}
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/recipes/${recipe.slug}`}
                          className="line-clamp-2 font-medium leading-snug underline-offset-4 hover:underline"
                        >
                          {recipe.title}
                        </a>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="inline-flex items-center rounded-full border border-border p-0.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-7"
                              aria-label={t("recipe.fewerServings")}
                              onClick={() => void updateServings(recipe.id, Math.max(1, servings - 1))}
                              disabled={servings <= 1}
                            >
                              <Minus className="size-3.5" />
                            </Button>
                            <span className="w-7 text-center text-sm font-medium tabular-nums" aria-live="polite">
                              {servings}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-7"
                              aria-label={t("recipe.moreServings")}
                              onClick={() => void updateServings(recipe.id, servings + 1)}
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </div>
                          <span className="text-sm text-muted-foreground">{t("shopping.servings")}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={t("shopping.removeFromList")}
                        onClick={() => void removeItem(recipe.id)}
                      >
                        <X />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => setPickerOpen(!pickerOpen)}
            aria-expanded={pickerOpen}
            aria-controls="recipe-picker"
          >
            {t("shopping.selectRecipes")}
            <ChevronDown className={`transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
          </Button>

          {pickerOpen && (
            <div id="recipe-picker" className="mt-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("shopping.searchRecipes")}
                  aria-label={t("shopping.searchRecipes")}
                  className="pl-10"
                />
              </div>

              {filteredRecipes.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">{t("recipe.noRecipes")}</p>
              ) : (
                <ul className="mt-2 max-h-80 overflow-y-auto divide-y divide-border border-b border-border">
                  {filteredRecipes.map((recipe) => {
                    const inList = inListSet.has(recipe.id);

                    return (
                      <li key={recipe.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={inList}
                          onClick={() => {
                            if (inList) {
                              void removeItem(recipe.id);
                            } else {
                              void addItem(recipe.id, recipe.servings || 4);
                            }
                          }}
                          className="group flex w-full items-start gap-3 py-3 text-left"
                        >
                          <span
                            className={`mt-[3px] flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${
                              inList
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground group-hover:border-foreground"
                            }`}
                          >
                            {inList && <Check className="size-3" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">{recipe.title}</span>
                          {inList && (
                            <span className="shrink-0 text-sm text-muted-foreground">
                              {listItemMap.get(recipe.id)} {t("shopping.servings")}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
