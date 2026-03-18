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

function formatListAsCheckboxes(
  categories: OrganizedCategory[] | null,
  merged: MergedIngredient[],
  checkedItems: Set<string>
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
        onClick={() => toggleCheck(itemKey)}
        className={`group flex items-center gap-3.5 w-full text-left py-3 px-3 -mx-3 rounded-xl transition-all duration-200 ${
          checked
            ? "opacity-45"
            : "hover:bg-secondary/60 active:scale-[0.99]"
        }`}
        style={{ width: "calc(100% + 1.5rem)" }}
      >
        {/* Custom circular checkbox */}
        <span
          className={`relative flex-shrink-0 w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${
            checked
              ? "bg-primary border-primary shadow-sm shadow-primary/30"
              : "border-border/60 group-hover:border-primary/40"
          }`}
        >
          {checked && (
            <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
          )}
        </span>

        {/* Amount + unit */}
        {amount ? (
          <span
            className={`flex-shrink-0 font-semibold tabular-nums text-sm transition-all ${
              checked
                ? "line-through text-muted-foreground/40"
                : "text-primary"
            }`}
            style={{ minWidth: "3.5rem" }}
          >
            {amount}
            {unit && (
              <span className={`ml-1 font-normal ${checked ? "" : "text-primary/60"}`}>
                {unit}
              </span>
            )}
          </span>
        ) : (
          <span className="flex-shrink-0" style={{ minWidth: "3.5rem" }} />
        )}

        {/* Name */}
        <span
          className={`text-sm leading-snug transition-all ${
            checked
              ? "line-through text-muted-foreground/40 decoration-muted-foreground/25"
              : "text-foreground/85"
          }`}
        >
          {name}
        </span>
      </button>
    </li>
  );
}

/* Category accent colors — cycles through warm palette */
const CATEGORY_ACCENTS = [
  "border-l-primary/60",
  "border-l-amber-400/60",
  "border-l-orange-400/50",
  "border-l-yellow-500/50",
  "border-l-primary/40",
  "border-l-amber-500/50",
];

const CATEGORY_BG = [
  "bg-primary/[0.04]",
  "bg-amber-400/[0.04]",
  "bg-orange-400/[0.04]",
  "bg-yellow-500/[0.04]",
  "bg-primary/[0.03]",
  "bg-amber-500/[0.04]",
];

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
      // Compare only recipe-based signature so manual item changes don't clear organized
      const recipeOnlySig = listSignature(currentState.items.filter((i) => i.type === "recipe"));
      const hasOrganized = !!(currentState.organized && currentState.organizedFor === recipeOnlySig);

      setListItems(currentState.items);
      setOrganized(hasOrganized ? currentState.organized : null);
      setCheckedItems(new Set(currentState.checked));

      if (hasOrganized) {
        organizedForRecipeSig.current = recipeOnlySig;
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
    manualItems.forEach((item) => {
      if (checkedItems.has(`manual-organized-${item.id}`)) checkedNames.push(item.name.toLowerCase());
    });

    try {
      const res = await fetch("/api/shopping-list/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: merged, checkedNames }),
      });
      if (res.ok) {
        const data = await res.json();
        // Build checked set from the checked field returned by the LLM
        const newChecked = new Set<string>();
        for (const cat of data.categories as OrganizedCategory[]) {
          cat.items.forEach((item: { name: string; checked?: boolean }, i: number) => {
            if (item.checked) newChecked.add(`${cat.name}-${i}`);
          });
        }
        manualItems.forEach((item) => {
          if (checkedNames.includes(item.name.toLowerCase())) newChecked.add(`manual-organized-${item.id}`);
        });
        setOrganized(data.categories);
        setCheckedItems(newChecked);
        saveChecked(Array.from(newChecked));
        saveOrganized(data.categories, recipeOnlySignature);
        organizedForRecipeSig.current = recipeOnlySignature;
      }
    } catch {
      // silently fail
    } finally {
      setOrganizing(false);
    }
  }

  async function handleCopy() {
    const text = formatListAsCheckboxes(organized, merged, checkedItems);
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
    <div className="max-w-6xl mx-auto">

      {/* ─── Page header ─── */}
      <div className="mb-10 animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ShoppingBasket className="w-5 h-5 text-primary" />
              </div>
              <h1 className="font-serif text-4xl md:text-5xl tracking-tight">
                {t("shopping.title")}
              </h1>
            </div>
          </div>

          {/* Progress pill — visible when there are items */}
          {hasItems && checkedCount > 0 && (
            <div className="flex-shrink-0 flex flex-col items-end gap-1 pt-1 animate-scale-in">
              <span className="text-[11px] font-medium text-muted-foreground/60 tabular-nums">
                {checkedCount}/{totalCount}
              </span>
              {/* Progress bar */}
              <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${(checkedCount / totalCount) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Count metadata */}
        {hasItems && (
          <p
            className="mt-3 ml-[3.25rem] text-sm text-muted-foreground/50 animate-fade-in"
            style={{ animationDelay: "80ms" }}
          >
            {[
              recipeCount > 0 ? `${recipeCount} ${t("shopping.recipeCount")}` : null,
              manualCount > 0 ? `${manualCount} ${t("shopping.manualCount")}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {/* ─── Empty state ─── */}
      {!hasItems && !hasSelectedRecipes && (
        <div
          className="flex flex-col items-center justify-center py-24 text-center animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          {/* Decorative basket */}
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex items-center justify-center shadow-lg shadow-primary/5">
              <ShoppingBasket className="w-11 h-11 text-primary/40" />
            </div>
            {/* Floating dot accents */}
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary/15 border border-primary/20" />
            <div className="absolute -bottom-2 -left-2 w-3 h-3 rounded-full bg-amber-300/20 border border-amber-400/20" />
          </div>
          <h2 className="font-serif text-2xl text-foreground/70 mb-2">
            {t("shopping.empty")}
          </h2>
          <p className="text-muted-foreground/50 text-sm max-w-xs leading-relaxed">
            {t("shopping.emptyHint")}
          </p>
        </div>
      )}

      {/* ─── Two-column layout (left: management, right: ingredients) ─── */}
      <div className={`${hasItems ? "lg:grid lg:grid-cols-[1fr_1.35fr] lg:gap-10 lg:items-start" : ""}`}>

        {/* ════ LEFT COLUMN: Recipe management + manual add ════ */}
        <div className="space-y-5">

          {/* ── Manual item add form ── */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: "80ms" }}
          >
            <div className="rounded-2xl border border-border/40 bg-card/60 p-4 shadow-sm shadow-black/[0.04]">
              {/* Label row */}
              <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/60 mb-3">
                {t("shopping.manualLabel")}
              </p>
              <form
                onSubmit={handleAddManualItem}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    ref={manualNameRef}
                    id="manual-item-name"
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder={t("shopping.manualPlaceholder")}
                    className="w-full rounded-xl border border-border/30 bg-secondary/40 px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-xl gap-1.5 px-3.5 h-[2.375rem] shadow-sm shadow-primary/20 flex-shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("shopping.addManual")}
                </Button>
              </form>

            </div>
          </div>

          {/* ── Selected recipes strip ── */}
          {hasSelectedRecipes && (
            <div
              className="animate-fade-up"
              style={{ animationDelay: "100ms" }}
            >
              <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/60 mb-3">
                {recipeCount} {t("shopping.recipeCount")}
              </p>
              <div className="relative -mx-1">
                {/* Scroll fade indicators */}
                {canScrollLeft && (
                  <div className="absolute left-0 top-0 bottom-1.5 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                )}
                {canScrollRight && (
                  <div className="absolute right-0 top-0 bottom-1.5 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
                )}
                <div
                  ref={stripRef}
                  className="px-1 flex gap-2.5 overflow-x-auto pb-1.5"
                  style={{ scrollbarWidth: "none" }}
                >
                  {selectedRecipes.map((recipe) => {
                    const servings = listItemMap.get(recipe.id);
                    if (!servings) return null;
                    const imageUrl = recipe.imageUrl
                      ? (recipe.imageUrl.startsWith("/")
                          ? `/api/uploads${recipe.imageUrl}`
                          : recipe.imageUrl)
                      : null;

                    return (
                      <div
                        key={recipe.id}
                        className="group relative shrink-0 w-[175px] rounded-2xl overflow-hidden border border-border/30 shadow-sm shadow-black/[0.05] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/[0.06]"
                      >
                        {/* Image background with gradient overlay */}
                        {imageUrl ? (
                          <div className="absolute inset-0">
                            <img
                              src={imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-secondary to-secondary/60">
                            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                              <ShoppingBasket className="w-12 h-12 text-muted-foreground" />
                            </div>
                          </div>
                        )}

                        {/* Content overlay */}
                        <div className="relative z-10 p-3 pt-8 flex flex-col gap-2">
                          {/* Title */}
                          <a
                            href={`/recipes/${recipe.slug}`}
                            className={`block text-xs font-semibold leading-tight line-clamp-2 transition-opacity hover:opacity-80 ${
                              imageUrl ? "text-white" : "text-foreground/80"
                            }`}
                          >
                            {recipe.title}
                          </a>

                          {/* Servings row */}
                          <div className="flex items-center justify-between">
                            <div className={`flex items-center gap-1 rounded-lg px-1.5 py-0.5 ${
                              imageUrl
                                ? "bg-black/30 backdrop-blur-sm"
                                : "bg-background/70"
                            }`}>
                              <button
                                onClick={() =>
                                  void updateServings(
                                    recipe.id,
                                    Math.max(1, servings - 1)
                                  )
                                }
                                className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                  imageUrl
                                    ? "text-white/70 hover:text-white hover:bg-white/15"
                                    : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-secondary"
                                }`}
                                disabled={servings <= 1}
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className={`text-xs tabular-nums font-semibold w-4 text-center ${
                                imageUrl ? "text-white" : "text-foreground/80"
                              }`}>
                                {servings}
                              </span>
                              <button
                                onClick={() =>
                                  void updateServings(recipe.id, servings + 1)
                                }
                                className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                  imageUrl
                                    ? "text-white/70 hover:text-white hover:bg-white/15"
                                    : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-secondary"
                                }`}
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                              <span className={`text-[9px] ml-0.5 ${
                                imageUrl ? "text-white/50" : "text-muted-foreground/40"
                              }`}>
                                {t("shopping.servings")}
                              </span>
                            </div>

                            {/* Remove button */}
                            <button
                              onClick={() => void removeItem(recipe.id)}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 ${
                                imageUrl
                                  ? "bg-white/15 hover:bg-red-500/70 text-white/70 hover:text-white backdrop-blur-sm"
                                  : "bg-secondary hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive"
                              }`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Recipe picker (collapsible) ── */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: "130ms" }}
          >
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground/70 hover:text-foreground transition-colors group w-full"
            >
              <div className={`w-5 h-5 rounded-md border border-border/40 bg-secondary/50 flex items-center justify-center transition-all duration-200 group-hover:border-primary/30 group-hover:bg-primary/5 ${
                pickerOpen ? "border-primary/30 bg-primary/5" : ""
              }`}>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-200 ${
                    pickerOpen ? "rotate-180 text-primary" : "text-muted-foreground/50"
                  }`}
                />
              </div>
              <span>{t("shopping.selectRecipes")}</span>
              <span className="text-xs text-muted-foreground/40 ml-auto font-normal">
                {allRecipes.length}
              </span>
            </button>

            {pickerOpen && (
              <div className="mt-3 rounded-2xl border border-border/40 bg-card/50 overflow-hidden animate-fade-up shadow-sm shadow-black/[0.03]">
                {/* Search input */}
                <div className="p-3 border-b border-border/25">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/35" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("shopping.searchRecipes")}
                      className="w-full pl-8.5 pr-3 py-2 text-sm bg-secondary/40 border border-border/25 rounded-xl placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/12 transition-all"
                    />
                  </div>
                </div>

                {/* Recipe list */}
                <div className="max-h-60 overflow-y-auto p-1.5">
                  {filteredRecipes.map((recipe) => {
                    const inList = inListSet.has(recipe.id);
                    const thumbUrl = recipe.imageUrl
                      ? (recipe.imageUrl.startsWith("/")
                          ? `/api/uploads${recipe.imageUrl}`
                          : recipe.imageUrl)
                      : null;

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
                        className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all duration-150 ${
                          inList
                            ? "bg-primary/8 hover:bg-primary/12"
                            : "hover:bg-secondary/60"
                        }`}
                      >
                        {/* Custom checkbox */}
                        <div
                          className={`w-4.5 h-4.5 rounded-md border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                            inList
                              ? "bg-primary border-primary"
                              : "border-border/50"
                          }`}
                        >
                          {inList && (
                            <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                          )}
                        </div>

                        {/* Thumbnail */}
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-secondary/80 flex-shrink-0" />
                        )}

                        <span className="text-sm truncate text-foreground/80 font-medium">
                          {recipe.title}
                        </span>

                        {inList && (
                          <span className="ml-auto text-[10px] text-primary/60 font-medium flex-shrink-0">
                            {listItemMap.get(recipe.id)} {t("shopping.servings")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════ RIGHT COLUMN: Ingredient list ════ */}
        {hasItems && merged.length > 0 && (
          <div
            className="mt-8 lg:mt-0 animate-fade-up"
            style={{ animationDelay: "160ms" }}
          >
            {/* Section heading */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl tracking-tight">
                {t("shopping.ingredients")}
              </h2>

              {/* Floating pill toolbar */}
              <div className="flex items-center gap-1 rounded-full border border-border/35 bg-card/90 backdrop-blur-sm px-1.5 py-1.5 shadow-sm shadow-black/[0.05]">
                {/* AI Organize */}
                <button
                  onClick={handleOrganize}
                  disabled={organizing || merged.length === 0}
                  title={t("shopping.organize")}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    organizing
                      ? "text-muted-foreground/50 cursor-wait"
                      : "text-primary/80 hover:bg-primary/8 hover:text-primary active:scale-95"
                  }`}
                >
                  <Sparkles
                    className={`w-3 h-3 ${organizing ? "animate-spin" : ""}`}
                  />
                  <span className="hidden sm:inline">
                    {organizing ? t("shopping.organizing") : t("shopping.organize")}
                  </span>
                </button>

                {/* Divider */}
                <span className="w-px h-4 bg-border/40" />

                {/* Copy */}
                <button
                  onClick={handleCopy}
                  disabled={merged.length === 0}
                  title={t("shopping.copy")}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    copied
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground/70 hover:bg-secondary/60 hover:text-foreground/80 active:scale-95"
                  }`}
                >
                  {copied ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <ClipboardCopy className="w-3 h-3" />
                  )}
                  <span className="hidden sm:inline">
                    {copied ? t("shopping.copied") : t("shopping.copy")}
                  </span>
                </button>


                {/* Divider */}
                <span className="w-px h-4 bg-border/40" />

                {/* Clear */}
                <button
                  onClick={() => void handleClear()}
                  title={t("shopping.clear")}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground/50 hover:bg-destructive/8 hover:text-destructive transition-all duration-200 active:scale-95"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden sm:inline">{t("shopping.clear")}</span>
                </button>
              </div>
            </div>

            {/* AI customization hint */}
            <div className="mb-4">
              <CustomizeHint />
            </div>

            {/* Warm separator */}
            <div className="separator-warm mb-6" />

            {/* ── AI-organized view ── */}
            {organized ? (
              <div className="space-y-7 pb-16">
                {organized.map((category, catIdx) => {
                  const accentBorder = CATEGORY_ACCENTS[catIdx % CATEGORY_ACCENTS.length];
                  const accentBg = CATEGORY_BG[catIdx % CATEGORY_BG.length];
                  const checkedInCat = category.items.filter(
                    (_, i) => checkedItems.has(`${category.name}-${i}`)
                  ).length;

                  return (
                    <div
                      key={category.name}
                      className="animate-fade-up"
                      style={{ animationDelay: `${catIdx * 50}ms` }}
                    >
                      {/* Category header */}
                      <div className={`flex items-center justify-between mb-1 pl-3 border-l-2 ${accentBorder} py-0.5`}>
                        <h3 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70">
                          {category.name}
                        </h3>
                        <span className="text-[10px] text-muted-foreground/40 tabular-nums font-medium">
                          {checkedInCat > 0 ? `${checkedInCat}/` : ""}
                          {category.items.length}
                        </span>
                      </div>

                      {/* Items */}
                      <ul className={`rounded-xl ${accentBg} px-0 divide-y divide-border/20`}>
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
                {manualItems.length > 0 && (
                  <div>
                    <div className={`flex items-center justify-between mb-1 pl-3 border-l-2 border-border/40 py-0.5`}>
                      <h3 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/50">
                        {t("shopping.manualLabel")}
                      </h3>
                      <span className="text-[10px] text-muted-foreground/40 tabular-nums font-medium">
                        {manualItems.length}
                      </span>
                    </div>
                    <ul className="divide-y divide-border/20">
                      {manualItems.map((item) => {
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
              /* ── Basic merged view ── */
              <div className="pb-16">
                <ul className="divide-y divide-border/20">
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
