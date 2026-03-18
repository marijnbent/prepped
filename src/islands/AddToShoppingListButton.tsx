import { useState, useEffect } from "react";
import { ShoppingBasket, Check } from "lucide-react";
import { t } from "@/lib/i18n";
import {
  addItem,
  ensureShoppingListLoaded,
  getList,
  removeItem,
} from "@/lib/shopping-list-store";

interface Props {
  recipeId: number;
  defaultServings: number;
  showLabel?: boolean;
}

export default function AddToShoppingListButton({ recipeId, defaultServings, showLabel }: Props) {
  const [inList, setInList] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function sync() {
      setInList(
        getList().some((item) => item.type === "recipe" && item.recipeId === recipeId)
      );
    }

    void ensureShoppingListLoaded().then(() => {
      sync();
      setIsReady(true);
    });

    const handler = () => sync();
    window.addEventListener("shopping-list-change", handler);
    return () => window.removeEventListener("shopping-list-change", handler);
  }, [recipeId]);

  async function toggle() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      if (inList) {
        await removeItem(recipeId);
      } else {
        await addItem(recipeId, defaultServings);
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (showLabel) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void toggle();
        }}
        className={`inline-flex items-center gap-1.5 text-[13px] transition-colors duration-200 ${
          inList
            ? "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
            : "text-muted-foreground/60 hover:text-muted-foreground"
        }`}
        disabled={!isReady || isSaving}
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
        void toggle();
      }}
      className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium border transition-colors ${
        inList
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
          : "bg-secondary/60 text-muted-foreground border-border/30 hover:bg-secondary hover:text-foreground"
      }`}
      aria-label={inList ? t("shopping.removeFromList") : t("shopping.addToList")}
      disabled={!isReady || isSaving}
    >
      <ShoppingBasket className={`w-3 h-3 ${inList ? "fill-current/20" : ""}`} />
      <span className="sr-only">{inList ? t("shopping.removeFromList") : t("shopping.addToList")}</span>
    </button>
  );
}
