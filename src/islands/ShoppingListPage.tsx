import { useState, useEffect, useMemo, useRef, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Minus,
  Plus,
  X,
  Sparkles,
  ClipboardCopy,
  Check,
  Trash2,
  ChevronDown,
  Search,
  ShoppingBasket,
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
  removeManualItem,
  saveChecked,
  saveOrganized,
  updateServings,
  type ManualShoppingListItem,
} from "@/lib/shopping-list-store";
import {
  listSignature,
  type OrganizedCategory,
  type ShoppingListItem,
  type ShoppingListState,
} from "@/lib/shopping-list";

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
  merged: MergedIngredient[]
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
  } else {
    for (const item of merged) {
      const parts = [item.amount, item.unit, item.name].filter(Boolean);
      lines.push(`- ${parts.join(" ")}`);
    }
  }

  return lines.join("\n").trim();
}

/* Renders the "Customize AI behavior in {link}" hint, splitting on {link} placeholder */
function CustomizeHint() {
  const hint = t("shopping.customizeHint");
  const linkText = t("shopping.profileLink");
  const parts = hint.split("{link}");

  return (
    <p className="text-[11px] text-muted-foreground/50 mt-1.5">
      {parts[0]}
      <a
        href="/profile"
        className="underline underline-offset-2 decoration-muted-foreground/25 hover:text-muted-foreground/70 hover:decoration-muted-foreground/40 transition-colors"
      >
        {linkText}
      </a>
      {parts[1]}
    </p>
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
  const stripRef = useRef<HTMLDivElement>(null);
  const manualNameRef = useRef<HTMLInputElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    updateScrollIndicators();
    el.addEventListener("scroll", updateScrollIndicators, { passive: true });
    const ro = new ResizeObserver(updateScrollIndicators);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollIndicators);
      ro.disconnect();
    };
  }, [updateScrollIndicators, listItems]);

  const initializedRef = useRef(false);
  useEffect(() => {
    function syncFromStore() {
      const currentState = getShoppingListState();
      const currentSignature = listSignature(currentState.items);

      setListItems(currentState.items);
      setOrganized(
        currentState.organized && currentState.organizedFor === currentSignature
          ? currentState.organized
          : null
      );
      setCheckedItems(new Set(currentState.checked));
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

  // Clear organized view only when recipes/servings changed from the organized snapshot
  useEffect(() => {
    if (!initializedRef.current) return;
    if (!organized) return;
    const currentSignature = listSignature(listItems);
    if (getShoppingListState().organizedFor !== currentSignature) {
      setOrganized(null);
      setCheckedItems(new Set());
      saveChecked([]);
      clearOrganized();
    }
  }, [listItems, organized]);

  const filteredRecipes = useMemo(() => {
    if (!searchQuery) return allRecipes;
    const q = searchQuery.toLowerCase();
    return allRecipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [allRecipes, searchQuery]);

  async function handleOrganize() {
    if (merged.length === 0) return;
    setOrganizing(true);
    try {
      const res = await fetch("/api/shopping-list/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: merged }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrganized(data.categories);
        setCheckedItems(new Set());
        saveChecked([]);
        saveOrganized(data.categories, listSignature(listItems));
      }
    } catch {
      // silently fail
    } finally {
      setOrganizing(false);
    }
  }

  async function handleCopy() {
    const text = formatListAsText(organized, merged);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleClear() {
    if (confirm(t("shopping.clearConfirm"))) {
      await clearList();
      setOrganized(null);
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
  const manualCount = manualItems.length;
  const totalCount = organized
    ? organized.reduce((sum, cat) => sum + cat.items.length, 0)
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

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight animate-fade-up">
          {t("shopping.title")}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <span className="inline-flex items-center rounded-full border border-border/40 bg-card/70 px-3 py-1 text-xs text-foreground/75">
            {t("shopping.savedAccount")}
          </span>
          <span className="inline-flex items-center rounded-full border border-border/30 bg-secondary/50 px-3 py-1 text-xs text-muted-foreground/70">
            {t("shopping.syncHint")}
          </span>
          {hasItems && (
            <span className="text-sm text-muted-foreground/50">
              {[recipeCount > 0 ? `${recipeCount} ${t("shopping.recipeCount")}` : null, manualCount > 0 ? `${manualCount} ${t("shopping.manualCount")}` : null]
                .filter(Boolean)
                .join(" · ")}
              {checkedCount > 0 && (
                <span className="ml-2 text-primary/60">
                  &middot; {checkedCount}/{totalCount}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <div
        className="mb-6 animate-fade-up"
        style={{ animationDelay: "80ms" }}
      >
        <div className="rounded-2xl border border-border/40 bg-card/60 p-4 shadow-sm shadow-black/5">
          <form
            onSubmit={handleAddManualItem}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="manual-item-name"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                {t("shopping.manualLabel")}
              </label>
              <input
                ref={manualNameRef}
                id="manual-item-name"
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder={t("shopping.manualPlaceholder")}
                className="w-full rounded-lg border border-border/30 bg-secondary/40 px-3 py-2 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <Button type="submit" size="sm" className="gap-1.5 rounded-lg sm:self-end">
              <Plus className="h-3.5 w-3.5" />
              {t("shopping.addManual")}
            </Button>
          </form>

          {manualItems.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {manualItems.map((item) => (
                <div
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-border/30 bg-background px-3 py-1.5 text-sm"
                >
                  <span className="text-foreground/80">
                    {[item.amount, item.unit, item.name].filter(Boolean).join(" ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeManualItem(item.id)}
                    className="rounded text-muted-foreground/50 transition-colors hover:text-destructive"
                    aria-label={t("shopping.removeManual")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Selected recipes: horizontal scroll strip ── */}
      {hasSelectedRecipes ? (
        <div
          className="mb-6 animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          <div className="relative -mx-4">
            {/* Scroll fade indicators */}
            {canScrollLeft && (
              <div className="absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            )}
            {canScrollRight && (
              <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            )}
            <div
              ref={stripRef}
              className="px-4 flex gap-2.5 overflow-x-auto pb-2 scrollbar-none"
              style={{ scrollbarWidth: "none" }}
            >
            {selectedRecipes.map((recipe) => {
              const servings = listItemMap.get(recipe.id);
              if (!servings) return null;
              return (
                <div
                  key={recipe.id}
                  className="group relative flex items-center gap-2.5 rounded-xl bg-card/80 border border-border/30 p-2 pr-3 shrink-0 w-[200px] sm:w-[220px] transition-all duration-200 hover:border-border/50 hover:shadow-sm"
                >
                  {/* Thumbnail */}
                  {recipe.imageUrl ? (
                    <a href={`/recipes/${recipe.slug}`}>
                      <img
                        src={
                          recipe.imageUrl.startsWith("/")
                            ? `/api/uploads${recipe.imageUrl}`
                            : recipe.imageUrl
                        }
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    </a>
                  ) : (
                    <a href={`/recipes/${recipe.slug}`} className="w-10 h-10 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                      <ShoppingBasket className="w-4 h-4 text-muted-foreground/30" />
                    </a>
                  )}

                  {/* Title + servings adjuster */}
                  <div className="min-w-0">
                    <a href={`/recipes/${recipe.slug}`} className="text-sm font-medium truncate max-w-[120px] sm:max-w-[150px] block hover:text-primary transition-colors">
                      {recipe.title}
                    </a>
                    <div className="flex items-center gap-1 mt-0.5">
                      <button
                        onClick={() =>
                          void updateServings(
                            recipe.id,
                            Math.max(1, servings - 1)
                          )
                        }
                        className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/60 hover:bg-secondary hover:text-muted-foreground transition-colors"
                        disabled={servings <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs tabular-nums w-4 text-center text-muted-foreground">
                        {servings}
                      </span>
                      <button
                        onClick={() =>
                          void updateServings(recipe.id, servings + 1)
                        }
                        className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/60 hover:bg-secondary hover:text-muted-foreground transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] text-muted-foreground/40 ml-0.5">
                        {t("shopping.servings")}
                      </span>
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => void removeItem(recipe.id)}
                    className="ml-0.5 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      ) : (
        !hasItems && (
          /* ── Empty state ── */
          <div
            className="text-center py-20 animate-fade-up"
            style={{ animationDelay: "100ms" }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-secondary/80 border border-border/30 mb-6">
              <ShoppingBasket className="w-9 h-9 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground text-lg font-serif">
              {t("shopping.empty")}
            </p>
            <p className="text-muted-foreground/40 text-sm mt-2">
              {t("shopping.emptyHint")}
            </p>
          </div>
        )
      )}

      {/* ── Recipe picker (collapsible) ── */}
      <div
        className="mb-8 animate-fade-up"
        style={{ animationDelay: "150ms" }}
      >
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              pickerOpen ? "rotate-180" : ""
            }`}
          />
          {t("shopping.selectRecipes")}
        </button>

        {pickerOpen && (
          <div className="mt-3 rounded-xl border border-border/40 bg-card/50 overflow-hidden animate-fade-up">
            {/* Search input */}
            <div className="p-3 border-b border-border/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("shopping.searchRecipes")}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/40 border border-border/30 rounded-lg placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>

            {/* Recipe list */}
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredRecipes.map((recipe) => {
                const inList = inListSet.has(recipe.id);
                return (
                  <button
                    key={recipe.id}
                    onClick={() => {
                      if (inList) {
                        void removeItem(recipe.id);
                      } else {
                        void addItem(recipe.id, recipe.servings || 4);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-secondary/50 transition-colors"
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        inList
                          ? "bg-primary border-primary"
                          : "border-border/60"
                      }`}
                    >
                      {inList && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    {recipe.imageUrl ? (
                      <img
                        src={
                          recipe.imageUrl.startsWith("/")
                            ? `/api/uploads${recipe.imageUrl}`
                            : recipe.imageUrl
                        }
                        alt=""
                        className="w-8 h-8 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-md bg-secondary/60 shrink-0" />
                    )}
                    <span className="text-sm truncate">{recipe.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Ingredients section with sticky toolbar ── */}
      {hasItems && merged.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          {/* Section heading */}
          <h2 className="font-serif text-2xl tracking-tight mb-4 flex items-center gap-3">
            {t("shopping.ingredients")}
            <span className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent" />
          </h2>

          {/* ── Sticky action toolbar ── */}
          <div className="sticky top-0 z-20 -mx-4 mb-4 px-4 py-3 backdrop-blur-xl">
            <div className="rounded-2xl border border-border/30 bg-background/85 px-3 py-3 shadow-sm shadow-black/5">
              <div className="flex flex-wrap items-center gap-2">
              {/* AI Organize */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleOrganize}
                disabled={organizing || merged.length === 0}
                className={`gap-1.5 rounded-lg border-border/40 ${
                  organizing
                    ? ""
                    : "hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                <Sparkles
                  className={`w-3.5 h-3.5 ${
                    organizing ? "animate-spin" : "text-primary/70"
                  }`}
                />
                {organizing
                  ? t("shopping.organizing")
                  : t("shopping.organize")}
              </Button>

              {/* Copy list */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={merged.length === 0}
                className="gap-1.5 rounded-lg border-border/40"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t("shopping.copied")}
                    </span>
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="w-3.5 h-3.5" />
                    {t("shopping.copy")}
                  </>
                )}
              </Button>

              {/* Spacer pushes clear to the right on wider screens */}
              <div className="flex-1" />

              {/* Clear */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleClear()}
                className="gap-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("shopping.clear")}
              </Button>
            </div>

            {/* AI customization hint */}
              <CustomizeHint />
            </div>
          </div>

          {/* ── Ingredient list ── */}
          {organized ? (
            /* AI-organized view with categories */
            <div className="space-y-8 pb-12">
              {organized.map((category, catIdx) => (
                <div
                  key={category.name}
                  className="animate-fade-up"
                  style={{ animationDelay: `${catIdx * 60}ms` }}
                >
                  <h3 className="text-[11px] uppercase tracking-[0.1em] font-semibold text-primary/60 mb-3 flex items-center gap-2">
                    {category.name}
                    <span className="flex-1 h-px bg-primary/10" />
                    <span className="text-[10px] font-normal text-muted-foreground/40 tabular-nums">
                      {category.items.length}
                    </span>
                  </h3>
                  <ul className="space-y-0.5">
                    {category.items.map((item, i) => {
                      const key = `${category.name}-${i}`;
                      const checked = checkedItems.has(key);
                      return (
                        <li key={key}>
                          <button
                            onClick={() => toggleCheck(key)}
                            className={`flex items-center gap-3 text-sm py-2 px-2 -mx-2 w-[calc(100%+1rem)] rounded-lg text-left transition-all duration-200 ${
                              checked
                                ? "opacity-40"
                                : "hover:bg-secondary/40"
                            }`}
                          >
                            <div
                              className={`w-[18px] h-[18px] rounded-md border-[1.5px] shrink-0 flex items-center justify-center transition-all duration-200 ${
                                checked
                                  ? "bg-primary/20 border-primary/50"
                                  : "border-border/50"
                              }`}
                            >
                              {checked && (
                                <Check className="w-2.5 h-2.5 text-primary" />
                              )}
                            </div>
                            {item.amount && (
                              <span
                                className={`font-medium tabular-nums text-primary/80 min-w-[3rem] ${
                                  checked ? "line-through" : ""
                                }`}
                              >
                                {item.amount}
                                {item.unit && (
                                  <span className="text-muted-foreground/50 ml-0.5 font-normal">
                                    {item.unit}
                                  </span>
                                )}
                              </span>
                            )}
                            <span
                              className={`text-foreground/80 ${
                                checked
                                  ? "line-through decoration-muted-foreground/30"
                                  : ""
                              }`}
                            >
                              {item.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            /* Basic merged view */
            <div className="space-y-8 pb-12">
              {merged.length > 0 && (
                <ul className="space-y-0.5">
                  {merged.map((item, i) => {
                    const key = `merged-${i}`;
                    const checked = checkedItems.has(key);
                    return (
                      <li key={key}>
                        <button
                          onClick={() => toggleCheck(key)}
                          className={`flex items-center gap-3 text-sm py-2 px-2 -mx-2 w-[calc(100%+1rem)] rounded-lg text-left transition-all duration-200 ${
                            checked
                              ? "opacity-40"
                              : "hover:bg-secondary/40"
                          }`}
                        >
                          <div
                            className={`w-[18px] h-[18px] rounded-md border-[1.5px] shrink-0 flex items-center justify-center transition-all duration-200 ${
                              checked
                                ? "bg-primary/20 border-primary/50"
                                : "border-border/50"
                            }`}
                          >
                            {checked && (
                              <Check className="w-2.5 h-2.5 text-primary" />
                            )}
                          </div>
                          {item.amount && (
                            <span
                              className={`font-medium tabular-nums text-primary/80 min-w-[3rem] ${
                                checked ? "line-through" : ""
                              }`}
                            >
                              {item.amount}
                              {item.unit && (
                                <span className="text-muted-foreground/50 ml-0.5 font-normal">
                                  {item.unit}
                                </span>
                              )}
                            </span>
                          )}
                          <span
                            className={`text-foreground/80 ${
                              checked
                                ? "line-through decoration-muted-foreground/30"
                                : ""
                            }`}
                          >
                            {item.name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
