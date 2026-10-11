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
        className="inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-foreground px-[18px] text-sm font-medium transition-colors hover:bg-secondary"
      >
        <Bookmark className={`size-4 ${isSaved ? "fill-current" : ""}`} />
        {isSaved ? t("recipe.alreadySavedInCollection") : t("recipe.saveToCollection")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("recipe.saveToCollectionTitle")}</DialogTitle>
            <DialogDescription>
              {t("recipe.saveToCollectionDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {collections.length > 0 ? (
              <div className="-mx-3 max-h-56 overflow-y-auto">
                {collections.map((col) => (
                  <label
                    key={col.id}
                    className="flex cursor-pointer items-center gap-3 rounded-full px-3 py-2 transition-colors hover:bg-secondary"
                  >
                    <Checkbox
                      checked={selected.includes(col.id)}
                      onCheckedChange={() => toggleCollection(col.id)}
                    />
                    <span className="min-w-0 truncate">{col.name}</span>
                    <span className="ml-auto text-sm text-muted-foreground tabular-nums">{col.recipeCount}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("collection.noCollections")}</p>
            )}
            <Button
              onClick={handleSave}
              disabled={loading || saved || !hasChanges}
              size="lg"
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
