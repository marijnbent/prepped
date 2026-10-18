import { useState, useMemo, useEffect } from "react";
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

  useEffect(() => {
    document.documentElement.dataset.recipeServings = String(servings);
    window.dispatchEvent(new CustomEvent("prepped:servings-change", { detail: { servings } }));
  }, [servings]);

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
      <div className="flex flex-wrap items-center gap-3 mb-7">
        <span className="text-sm text-muted-foreground">{t("recipe.servings")}</span>
        <div className="inline-flex items-center rounded-full border border-border p-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={t("recipe.fewerServings")} onClick={() => setServings(Math.max(1, servings - 1))} disabled={servings <= 1}><Minus className="h-4 w-4" strokeWidth={2} /></Button>
          <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">{servings}</span>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={t("recipe.moreServings")} onClick={() => setServings(servings + 1)}><Plus className="h-4 w-4" strokeWidth={2} /></Button>
        </div>
        {servings !== defaultServings && <button onClick={() => setServings(defaultServings)} className="text-sm text-muted-foreground hover:underline underline-offset-4">{t("recipe.reset")}</button>}
      </div>
      <ul className="space-y-6">
        {groups.map(({ group, items: ings }) => (
          <li key={group}>
            {group && <h4 className="font-medium mb-3">{group}</h4>}
            <ul className="space-y-3">
              {ings.map((ing, i) => {
                const { primary, secondary } = splitIngredientName(ing.name);
                return (
                  <li key={i} className="flex items-baseline gap-3 text-base leading-relaxed">
                    {ing.amount ? <mark className="shrink-0 rounded-[6px] bg-highlight text-highlight-foreground px-[7px] font-medium whitespace-nowrap tabular-nums">{ing.amount}{ing.unit && ` ${ing.unit}`}</mark> : <span className="shrink-0 text-sm text-muted-foreground">{t("recipe.toTaste")}</span>}
                    <span className="min-w-0 break-words">{primary}{secondary && <span className="block text-sm text-muted-foreground">{secondary.replace(/^,\s*/, "")}</span>}</span>
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
