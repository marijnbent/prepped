import { useState } from "react";
import { GitFork } from "lucide-react";
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

export default function CopyRecipeDialog({ recipeId, collections }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  function toggleCollection(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleCopy() {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId,
          collectionIds: selected.length > 0 ? selected : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = `/recipes/${data.slug}`;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary/60 text-muted-foreground border border-border/30 hover:bg-secondary hover:text-foreground transition-colors"
          aria-label={t("recipe.copy")}
        >
          <GitFork className="w-3 h-3" />
          <span className="sr-only sm:not-sr-only">{t("recipe.fork")}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{t("recipe.copyToMyRecipes")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">{t("recipe.forkDesc")}</p>
          {collections.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                {t("recipe.addToCollections")}
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
          )}
          <Button
            onClick={handleCopy}
            disabled={loading || selected.length === 0}
            className="w-full"
          >
            {loading ? t("recipe.copying") : t("recipe.copyRecipe")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
