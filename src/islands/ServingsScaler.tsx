import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { t } from "@/lib/i18n";
import { scaleAmount } from "@/lib/scale-amount";

interface Ingredient {
  amount: string;
  unit: string;
  name: string;
  group?: string;
}

interface Props {
  defaultServings: number;
  ingredients: Ingredient[];
}

export default function ServingsScaler({ defaultServings, ingredients }: Props) {
  const [servings, setServings] = useState(defaultServings);

  const factor = servings / defaultServings;

  const scaledIngredients = useMemo(
    () =>
      ingredients.map((ing) => ({
        ...ing,
        amount: scaleAmount(ing.amount, factor),
      })),
    [ingredients, factor]
  );

  // Group ingredients
  const groups = useMemo(() => {
    const grouped = new Map<string, typeof scaledIngredients>();
    for (const ing of scaledIngredients) {
      const group = ing.group || "";
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(ing);
    }
    return grouped;
  }, [scaledIngredients]);

  return (
    <div>
      {/* Scaler control */}
      <div className="sticky top-14 z-10 bg-card/90 backdrop-blur-sm py-3 mb-5 border-b border-border/30">
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.1em] font-medium text-muted-foreground/60">{t("recipe.servings")}</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-lg border-border/40 bg-secondary/40 hover:bg-secondary hover:border-border/60 text-muted-foreground"
              onClick={() => setServings(Math.max(1, servings - 1))}
              disabled={servings <= 1}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="text-lg font-semibold w-8 text-center tabular-nums text-foreground">{servings}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-lg border-border/40 bg-secondary/40 hover:bg-secondary hover:border-border/60 text-muted-foreground"
              onClick={() => setServings(servings + 1)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {servings !== defaultServings && (
            <button
              onClick={() => setServings(defaultServings)}
              className="text-[11px] uppercase tracking-wide text-primary/60 hover:text-primary transition-colors"
            >
              {t("recipe.reset")}
            </button>
          )}
        </div>
      </div>

      {/* Ingredients list */}
      <ul className="space-y-1">
        {Array.from(groups.entries()).map(([group, ings]) => (
          <li key={group}>
            {group && (
              <h4 className="text-[11px] uppercase tracking-[0.1em] font-medium text-primary/50 mt-5 mb-2.5">{group}</h4>
            )}
            <ul className="space-y-2">
              {ings.map((ing, i) => (
                <li key={i} className="flex items-baseline gap-2.5 text-sm py-1 border-b border-border/15 last:border-0">
                  <span className="font-medium tabular-nums text-primary/80 min-w-[3rem]">
                    {ing.amount ? (
                      <>
                        {ing.amount}
                        {ing.unit && <span className="text-muted-foreground/50 ml-0.5">{ing.unit}</span>}
                      </>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs font-normal">{t("recipe.toTaste")}</span>
                    )}
                  </span>
                  <span className="text-foreground/80">
                    {(() => {
                      const parenIdx = ing.name.indexOf("(");
                      const commaIdx = ing.name.indexOf(",");
                      let splitIdx = -1;
                      if (parenIdx !== -1 && commaIdx !== -1) splitIdx = Math.min(parenIdx, commaIdx);
                      else if (parenIdx !== -1) splitIdx = parenIdx;
                      else if (commaIdx !== -1) splitIdx = commaIdx;

                      if (splitIdx === -1) return ing.name;
                      return (
                        <>
                          {ing.name.slice(0, splitIdx).trim()}
                          <span className="block text-xs text-muted-foreground/50 mt-0.5">
                            {ing.name.slice(splitIdx).trim()}
                          </span>
                        </>
                      );
                    })()}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
