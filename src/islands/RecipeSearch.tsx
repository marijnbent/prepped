import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";

interface Recipe {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  difficulty?: string | null;
}

interface Props {
  recipes: Recipe[];
  searchPlaceholder?: string;
  noResultsText?: string;
  minutesLabel?: string;
}

export default function RecipeSearch({
  recipes,
  searchPlaceholder = "Search recipes...",
  noResultsText = "No recipes found",
  minutesLabel = "min",
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return recipes;
    const q = query.toLowerCase();
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }, [recipes, query]);

  return (
    <div>
      {/* Search input — dark, minimal with warm focus glow */}
      <div className="relative mb-10 max-w-md">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <Input
          type="search"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-11 h-12 rounded-xl bg-secondary/60 backdrop-blur-sm border-border/30 border shadow-inner shadow-black/10 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/30 transition-all placeholder:text-muted-foreground/40 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        /* Empty state */
        <div className="text-center py-28">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-secondary/80 border border-border/30 mb-6">
            <svg
              className="w-9 h-9 text-muted-foreground/30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" />
            </svg>
          </div>
          <p className="text-muted-foreground text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
            {query ? noResultsText : "No recipes yet"}
          </p>
          {query && (
            <p className="text-muted-foreground/40 text-sm mt-2">
              Try a different search term
            </p>
          )}
        </div>
      ) : (
        /* Recipe grid — matches RecipeCard.astro visually */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {filtered.map((recipe, i) => {
            const totalTime =
              (recipe.prepTime || 0) + (recipe.cookTime || 0);
            return (
              <a
                key={recipe.id}
                href={`/recipes/${recipe.slug}`}
                className="group block animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="relative rounded-2xl bg-card overflow-hidden border border-border/40 transition-all duration-500 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/[0.06] hover:-translate-y-1.5">
                  {/* Image area */}
                  {recipe.imageUrl ? (
                    <div className="aspect-[4/3] overflow-hidden relative">
                      <img
                        src={
                          recipe.imageUrl.startsWith("/")
                            ? `/api/uploads${recipe.imageUrl}`
                            : recipe.imageUrl
                        }
                        alt={recipe.title}
                        className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 group-hover:brightness-110"
                        loading="lazy"
                      />
                      {/* Deep cinematic gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent opacity-70 pointer-events-none" />
                      {/* Title over image */}
                      <div className="absolute bottom-0 inset-x-0 p-4 pb-3">
                        <h3 className="text-xl leading-tight text-foreground line-clamp-2 drop-shadow-lg" style={{ fontFamily: 'var(--font-serif)' }}>
                          {recipe.title}
                        </h3>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-gradient-to-br from-secondary via-muted to-accent/30 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute top-6 right-6 w-24 h-24 rounded-full border border-primary/10" />
                      <div className="absolute bottom-8 left-8 w-16 h-16 rounded-full bg-primary/5" />
                      <svg
                        className="w-14 h-14 text-muted-foreground/20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" />
                      </svg>
                      <div className="absolute bottom-0 inset-x-0 p-4 pb-3">
                        <h3 className="text-xl leading-tight text-foreground/80 line-clamp-2" style={{ fontFamily: 'var(--font-serif)' }}>
                          {recipe.title}
                        </h3>
                      </div>
                    </div>
                  )}

                  {/* Content below title */}
                  <div className="px-4 pb-4 pt-2">
                    {recipe.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>
                    )}
                    {(totalTime > 0 || recipe.difficulty) && (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
                        {totalTime > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70">
                            <svg
                              className="w-3.5 h-3.5 text-primary/50"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6l4 2" />
                            </svg>
                            {totalTime} {minutesLabel}
                          </span>
                        )}
                        {recipe.difficulty && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 capitalize">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                recipe.difficulty === "easy"
                                  ? "bg-emerald-400"
                                  : recipe.difficulty === "medium"
                                  ? "bg-amber-400"
                                  : "bg-rose-400"
                              }`}
                            />
                            {recipe.difficulty}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hover ambient glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ring-1 ring-inset ring-primary/10" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
