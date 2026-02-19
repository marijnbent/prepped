import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Link, FileText, PenLine, Camera } from "lucide-react";
import RecipeForm from "./RecipeForm";

type Mode = "choose" | "manual" | "importing" | "review";

interface Props {
  tags: { id: number; name: string }[];
  collections: { id: number; name: string }[];
}

export default function NewRecipePage({ tags: initialTags, collections: initialCollections }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imported, setImported] = useState<any>(null);
  const [tags, setTags] = useState(initialTags);
  const [collections, setCollections] = useState(initialCollections);

  async function handleImportUrl() {
    if (!url.trim()) return;
    setError("");
    setLoading(true);
    setMode("importing");

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
        setMode("choose");
        return;
      }

      const data = await res.json();
      await refreshTagsCollections();
      setImported(data);
      setMode("review");
    } catch {
      setError("Failed to import recipe");
      setMode("choose");
    }
    setLoading(false);
  }

  async function handleImportText() {
    if (!pasteText.trim()) return;
    setError("");
    setLoading(true);
    setMode("importing");

    try {
      const res = await fetch("/api/recipes/import-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Import failed");
        setLoading(false);
        setMode("choose");
        return;
      }

      const data = await res.json();
      await refreshTagsCollections();
      setImported(data);
      setMode("review");
    } catch {
      setError("Failed to parse recipe");
      setMode("choose");
    }
    setLoading(false);
  }

  async function handleImportPhoto(file: File) {
    setError("");
    setLoading(true);
    setMode("importing");

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch("/api/recipes/import-photo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Import failed");
        setLoading(false);
        setMode("choose");
        return;
      }

      const data = await res.json();
      await refreshTagsCollections();
      setImported(data);
      setMode("review");
    } catch {
      setError("Failed to extract recipe from photo");
      setMode("choose");
    }
    setLoading(false);
  }

  async function refreshTagsCollections() {
    const [tagsRes, colsRes] = await Promise.all([
      fetch("/api/tags").then((r) => r.json()).catch(() => tags),
      fetch("/api/collections").then((r) => r.json()).catch(() => collections),
    ]);
    if (Array.isArray(tagsRes)) setTags(tagsRes);
    if (Array.isArray(colsRes)) setCollections(colsRes);
  }

  // Loading state
  if (mode === "importing") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Importing and structuring recipe...</p>
      </div>
    );
  }

  // Review imported recipe
  if (mode === "review" && imported) {
    return (
      <div>
        <div className="mb-6 p-4 bg-secondary/50 rounded-lg flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Recipe imported. Review and edit below before saving.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setImported(null);
              setMode("choose");
            }}
          >
            Start over
          </Button>
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
            sourceUrl: imported.sourceUrl || url || "",
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

  // Manual form
  if (mode === "manual") {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => setMode("choose")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to import options
          </button>
        </div>
        <RecipeForm tags={tags} collections={collections} />
      </div>
    );
  }

  // Choose mode
  return (
    <div className="max-w-2xl space-y-8">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Import from URL */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
            <Link className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Import from URL</h2>
            <p className="text-sm text-muted-foreground">
              Paste a link from a recipe website or Instagram
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/recipe"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleImportUrl();
              }
            }}
          />
          <Button onClick={handleImportUrl} disabled={!url.trim()}>
            Import
          </Button>
        </div>
      </div>

      {/* Paste text */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Paste recipe text</h2>
            <p className="text-sm text-muted-foreground">
              Paste recipe text from anywhere and we'll structure it for you
            </p>
          </div>
        </div>
        <Textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Paste a recipe here...\n\nIngredients:\n- 200g flour\n- 100g sugar\n...\n\nSteps:\n1. Preheat oven..."}
          rows={6}
        />
        <Button onClick={handleImportText} disabled={!pasteText.trim()}>
          Parse Recipe
        </Button>
      </div>

      {/* Import from photo */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Import from photo</h2>
              <p className="text-sm text-muted-foreground">
                Take a photo of a cookbook page or upload an image
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              Upload
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportPhoto(file);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      {/* Manual */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
              <PenLine className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Write manually</h2>
              <p className="text-sm text-muted-foreground">
                Fill in the recipe form yourself
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setMode("manual")}>
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}
