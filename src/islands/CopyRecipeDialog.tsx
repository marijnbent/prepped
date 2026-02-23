import { useState } from "react";
import { Copy } from "lucide-react";
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
  collections: { id: number; name: string }[];
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
          className="inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:h-auto sm:w-auto rounded-full sm:rounded-lg border border-border/50 bg-secondary/50 px-0 sm:px-4 py-0 sm:py-2 text-xs font-medium sm:uppercase sm:tracking-wide hover:bg-secondary hover:border-border transition-all duration-200"
          aria-label={t("recipe.copy")}
        >
          <Copy className="w-3.5 h-3.5" />
          <span className="sr-only sm:not-sr-only">{t("recipe.copy")}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{t("recipe.copyToMyRecipes")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
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
                  </label>
                ))}
              </div>
            </div>
          )}
          <Button
            onClick={handleCopy}
            disabled={loading}
            className="w-full"
          >
            {loading ? t("recipe.copying") : t("recipe.copyRecipe")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
