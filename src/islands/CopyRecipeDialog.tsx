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
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-secondary"
          aria-label={t("recipe.copy")}
          title={t("recipe.copy")}
        >
          <GitFork size={18} strokeWidth={1.75} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recipe.copyToMyRecipes")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <p className="text-muted-foreground">{t("recipe.forkDesc")}</p>
          {collections.length > 0 && (
            <div>
              <p className="mb-2 font-medium">
                {t("recipe.addToCollections")}
              </p>
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
            </div>
          )}
          <Button
            onClick={handleCopy}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? t("recipe.copying") : t("recipe.copyRecipe")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
