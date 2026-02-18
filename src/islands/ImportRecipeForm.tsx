import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import RecipeForm from "./RecipeForm";

interface Props {
  tags?: { id: number; name: string }[];
  collections?: { id: number; name: string }[];
}

export default function ImportRecipeForm({ tags: initialTags = [], collections: initialCollections = [] }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState(initialTags);
  const [collections, setCollections] = useState(initialCollections);
  const [error, setError] = useState("");
  const [imported, setImported] = useState<any>(null);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Import failed");
        setLoading(false);
        return;
      }

      const data = await res.json();
      // Refetch tags/collections since import may have created new ones
      const [tagsRes, colsRes] = await Promise.all([
        fetch("/api/tags").then((r) => r.json()),
        fetch("/api/collections").then((r) => r.json()).catch(() => collections),
      ]);
      setTags(tagsRes);
      if (Array.isArray(colsRes)) setCollections(colsRes);
      setImported(data);
    } catch {
      setError("Failed to import recipe");
    }
    setLoading(false);
  }

  if (imported) {
    return (
      <div>
        <div className="mb-6 p-4 bg-secondary/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Recipe imported from <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{url}</a>.
            Review and edit below before saving.
          </p>
        </div>
        <RecipeForm
          initial={{
            title: imported.title || "",
            description: imported.description || "",
            ingredients: imported.ingredients || [],
            steps: imported.steps || [],
            servings: imported.servings,
            prepTime: imported.prepTime,
            cookTime: imported.cookTime,
            difficulty: imported.difficulty,
            sourceUrl: imported.sourceUrl || url,
            videoUrl: imported.videoUrl || "",
            imageUrl: imported.imageUrl || "",
            notes: imported.notes || "",
            tagIds: imported.tagIds || [],
            collectionIds: imported.collectionIds || [],
          }}
          tags={tags}
          collections={collections}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleImport} className="space-y-4 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="url">Recipe URL</Label>
        <Input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://example.com/recipe"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Importing...
          </>
        ) : (
          "Import Recipe"
        )}
      </Button>
    </form>
  );
}
