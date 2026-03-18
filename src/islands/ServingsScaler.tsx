import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { t } from "@/lib/i18n";
import { scaleAmount } from "@/lib/scale-amount";
import { groupIngredientsCupboardLast } from "@/lib/ingredient-groups";

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

function splitIngredientName(name: string) {
  const parenIdx = name.indexOf("(");
  const commaIdx = name.indexOf(",");
  let splitIdx = -1;

  if (parenIdx !== -1 && commaIdx !== -1) splitIdx = Math.min(parenIdx, commaIdx);
  else if (parenIdx !== -1) splitIdx = parenIdx;
  else if (commaIdx !== -1) splitIdx = commaIdx;

  if (splitIdx === -1) {
    return { primary: name, secondary: "" };
  }

  return {
    primary: name.slice(0, splitIdx).trim(),
    secondary: name.slice(splitIdx).trim(),
  };
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
    return groupIngredientsCupboardLast(scaledIngredients);
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
        {groups.map(({ group, items: ings }) => (
          <li key={group}>
            {group && (
              <h4 className="text-[11px] uppercase tracking-[0.1em] font-medium text-primary/50 mt-5 mb-2.5">{group}</h4>
            )}
            <ul className="space-y-2">
              {ings.map((ing, i) => {
                const { primary, secondary } = splitIngredientName(ing.name);

                return (
                  <li
                    key={i}
                    className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-start gap-x-3 py-2 border-b border-border/15 last:border-0"
                  >
                    <span className="pt-0.5 text-[0.95rem] font-semibold leading-5 tabular-nums text-primary/85 whitespace-nowrap">
                      {ing.amount ? (
                        <>
                          <span>{ing.amount}</span>
                          {ing.unit && <span className="ml-1 text-primary/65 font-medium">{ing.unit}</span>}
                        </>
                      ) : (
                        <span className="text-[0.8rem] font-medium tracking-[0.01em] text-muted-foreground/65">
                          {t("recipe.toTaste")}
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 pt-0.5 text-[1.02rem] leading-6 text-foreground/85">
                      <span className="block text-balance">{primary}</span>
                      {secondary && (
                        <span className="mt-0.5 block text-[0.84rem] leading-5 text-muted-foreground/70">
                          {secondary}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
