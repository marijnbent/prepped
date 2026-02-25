import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/lib/i18n";

interface Props {
  recipeId: number;
  collections: { id: number; name: string; recipeCount: number }[];
}

export default function SaveRecipeDialog({ recipeId, collections }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleCollection(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/recipes/save-to-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, collectionIds: selected }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          setOpen(false);
          setSaved(false);
        }, 1200);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:h-auto sm:w-auto rounded-full sm:rounded-lg border border-primary/30 bg-primary/10 text-primary px-0 sm:px-4 py-0 sm:py-2 text-xs font-medium sm:uppercase sm:tracking-wide hover:bg-primary hover:text-primary-foreground transition-all duration-200"
          aria-label={t("recipe.saveToCollection")}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span className="sr-only sm:not-sr-only">{t("recipe.saveToCollection")}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{t("recipe.saveToCollectionTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {collections.length > 0 ? (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                {t("recipe.saveToCollectionDesc")}
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {collections.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.includes(col.id)}
                      onCheckedChange={() => toggleCollection(col.id)}
                    />
                    <span className="text-sm">{col.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto tabular-nums">{col.recipeCount}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("collection.noCollections")}</p>
          )}
          <Button
            onClick={handleSave}
            disabled={loading || saved || selected.length === 0}
            className="w-full"
          >
            {saved ? t("recipe.saved") : loading ? t("recipe.saving") : t("recipe.saveRecipe")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
