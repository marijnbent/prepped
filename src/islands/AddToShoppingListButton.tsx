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
        className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-[18px] py-[9px] text-sm font-medium disabled:opacity-60"
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
      className={`inline-flex items-center justify-center h-10 w-10 rounded-full text-xs font-medium border transition-colors ${
        inList
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-transparent text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
      }`}
      aria-label={inList ? t("shopping.removeFromList") : t("shopping.addToList")}
      disabled={!isReady || isSaving}
    >
      <ShoppingBasket className={`w-4 h-4 ${inList ? "fill-current/20" : ""}`} />
      <span className="sr-only">{inList ? t("shopping.removeFromList") : t("shopping.addToList")}</span>
    </button>
  );
}
