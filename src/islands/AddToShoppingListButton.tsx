import { useState, useEffect } from "react";
import { ShoppingBasket, Check } from "lucide-react";
import { t } from "@/lib/i18n";
import { addItem, removeItem, isInList } from "@/lib/shopping-list-store";

interface Props {
  recipeId: number;
  defaultServings: number;
  showLabel?: boolean;
}

export default function AddToShoppingListButton({ recipeId, defaultServings, showLabel }: Props) {
  const [inList, setInList] = useState(false);

  useEffect(() => {
    setInList(isInList(recipeId));
    const handler = () => setInList(isInList(recipeId));
    window.addEventListener("shopping-list-change", handler);
    return () => window.removeEventListener("shopping-list-change", handler);
  }, [recipeId]);

  function toggle() {
    if (inList) {
      removeItem(recipeId);
    } else {
      addItem(recipeId, defaultServings);
    }
  }

  if (showLabel) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        className={`inline-flex items-center gap-1.5 text-[13px] transition-colors duration-200 ${
          inList
            ? "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
            : "text-muted-foreground/60 hover:text-muted-foreground"
        }`}
      >
        {inList ? (
          <>
            <Check className="w-3.5 h-3.5" />
            {t("shopping.removeFromList")}
          </>
        ) : (
          <>
            <ShoppingBasket className="w-3.5 h-3.5" />
            {t("shopping.addToList")}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 shadow-sm transition-all duration-200 hover:scale-110 hover:border-amber-300 active:scale-95"
      aria-label={inList ? t("shopping.removeFromList") : t("shopping.addToList")}
    >
      <ShoppingBasket
        className={`w-4 h-4 transition-colors duration-200 ${
          inList
            ? "fill-amber-500/20 text-amber-500"
            : "fill-none text-muted-foreground hover:text-amber-400"
        }`}
      />
    </button>
  );
}
