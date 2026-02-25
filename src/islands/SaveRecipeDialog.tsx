import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/lib/i18n";

interface Props {
  recipeId: number;
  collections: { id: number; name: string; recipeCount: number }[];
  savedCollectionIds?: number[];
}

export default function SaveRecipeDialog({ recipeId, collections, savedCollectionIds = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>(savedCollectionIds);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const isSaved = savedCollectionIds.length > 0;

  function handleOpen() {
    setSelected(savedCollectionIds);
    setSaved(false);
    setOpen(true);
  }

  function toggleCollection(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSave() {
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
          window.location.reload();
        }, 600);
      }
    } finally {
      setLoading(false);
    }
  }

  const hasChanges =
    selected.length !== savedCollectionIds.length ||
    selected.some((id) => !savedCollectionIds.includes(id)) ||
    savedCollectionIds.some((id) => !selected.includes(id));

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          isSaved
            ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
            : "bg-secondary/60 text-muted-foreground border-border/30 hover:bg-secondary hover:text-foreground"
        }`}
      >
        <Bookmark className={`w-3 h-3 ${isSaved ? "fill-current" : ""}`} />
        {isSaved ? t("recipe.alreadySavedInCollection") : t("recipe.saveToCollection")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{t("recipe.saveToCollectionTitle")}</DialogTitle>
            <DialogDescription>
              {t("recipe.saveToCollectionDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {collections.length > 0 ? (
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
            ) : (
              <p className="text-sm text-muted-foreground">{t("collection.noCollections")}</p>
            )}
            <Button
              onClick={handleSave}
              disabled={loading || saved || !hasChanges}
              className="w-full"
            >
              {saved ? t("recipe.saved") : loading ? t("recipe.saving") : t("recipe.saveRecipe")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
