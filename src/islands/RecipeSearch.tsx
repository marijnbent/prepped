import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatStepDuration } from "@/lib/recipe-export";

interface Recipe {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  difficulty?: string | null;
  savedByUser?: boolean;
  createdBy?: string;
  createdByName?: string | null;
  forkSlug?: string;
}

interface CommunityRecipe {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  difficulty?: string | null;
  createdBy: string;
  authorName: string;
}

interface Props {
  recipes: Recipe[];
  communityRecipes?: CommunityRecipe[];
  searchPlaceholder?: string;
  noResultsText?: string;
  minutesLabel?: string;
  hoursLabel?: string;
}

export default function RecipeSearch({
  recipes,
  communityRecipes = [],
  searchPlaceholder = t("recipe.search"),
  noResultsText = t("recipe.noRecipes"),
  minutesLabel = t("recipe.minutes"),
  hoursLabel = t("recipe.hours"),
}: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Read ?search param on mount and auto-focus
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("search")) {
      const val = params.get("search") || "";
      setQuery(val);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, []);

  // Direct computation — no useMemo
  const q = query.trim().toLowerCase();
  const filtered = q
    ? recipes.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.createdByName?.toLowerCase().includes(q)
      )
    : recipes;

  const filteredCommunity = q && communityRecipes.length > 0
    ? communityRecipes.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.authorName?.toLowerCase().includes(q)
      )
    : [];

  const difficultyLabel = (d: string) => {
    if (d === "easy") return t("recipe.easy");
    if (d === "medium") return t("recipe.medium");
    if (d === "hard") return t("recipe.hard");
    return d;
  };

  const getRecipeHref = (recipe: Recipe) => {
    // If user has forked this recipe, link to their fork
    if (recipe.forkSlug) {
      return `/recipes/${recipe.forkSlug}`;
    }
    // Saved recipes from other users link to the original
    if (recipe.savedByUser && recipe.createdBy) {
      return `/users/${recipe.createdBy}/recipes/${recipe.slug}`;
    }
    return `/recipes/${recipe.slug}`;
  };

  // Saved recipes say whose they are and whether there is already a fork
  const savedLabel = (recipe: Recipe) => {
    if (!recipe.savedByUser) return null;
    return recipe.forkSlug ? t("recipe.alreadyForked") : t("recipe.savedBadge");
  };

  function tile(recipe: Recipe | CommunityRecipe, href: string, extra: (string | null | undefined)[]) {
    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
    const meta = [
      totalTime > 0 && formatStepDuration(totalTime, minutesLabel, hoursLabel),
      recipe.difficulty && difficultyLabel(recipe.difficulty).toLocaleLowerCase(),
      ...extra,
    ]
      .filter(Boolean)
      .join(", ");

    return (
      <a key={recipe.id} href={href} className="group block min-w-0">
        <div className="aspect-[4/3] overflow-hidden rounded-[20px] bg-secondary">
          {recipe.imageUrl && (
            <img
              src={recipe.imageUrl.startsWith("/") ? `/api/uploads${recipe.imageUrl}` : recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          )}
        </div>
        <h3 className="mt-4 text-xl font-medium tracking-[-0.025em] leading-tight line-clamp-2 group-hover:underline underline-offset-4">
          {recipe.title}
        </h3>
        {meta && <p className="mt-2 text-sm text-muted-foreground">{meta}</p>}
      </a>
    );
  }

  const gridClass = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10";

  return (
    <div>
      <div className="relative mb-10 max-w-lg">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          strokeWidth={2}
        />
        <input
          ref={inputRef}
          type="search"
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-11 pr-5 h-12 rounded-full bg-transparent border border-border placeholder:text-muted-foreground text-base"
        />
      </div>

      {filtered.length === 0 && filteredCommunity.length === 0 ? (
        <div className="py-16">
          <p className="text-xl font-medium">{query ? noResultsText : t("recipe.noRecipesYet")}</p>
          {query && <p className="text-muted-foreground mt-2">{t("recipe.tryDifferent")}</p>}
        </div>
      ) : (
        <>
          {filtered.length > 0 && (
            <div className={gridClass}>
              {filtered.map((recipe) =>
                tile(recipe, getRecipeHref(recipe), [recipe.createdByName, savedLabel(recipe)])
              )}
            </div>
          )}
          {filteredCommunity.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-medium tracking-tight mb-6">{t("recipe.communityResults")}</h2>
              <div className={gridClass}>
                {filteredCommunity.map((recipe) =>
                  tile(recipe, `/users/${recipe.createdBy}/recipes/${recipe.slug}`, [recipe.authorName])
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
