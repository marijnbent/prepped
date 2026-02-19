import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Link, FileText, PenLine, Camera } from "lucide-react";
import RecipeForm from "./RecipeForm";
import { t } from "@/lib/i18n";

type Mode = "choose" | "manual" | "importing" | "review";

interface Props {
  tags: { id: number; name: string }[];
  collections: { id: number; name: string }[];
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json() as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim().length > 0) {
      return data.error;
    }
  } catch {
    // Ignore parsing failures and use fallback.
  }
  return fallback;
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
        setError(await readErrorMessage(res, t("import.errorImport")));
        setLoading(false);
        setMode("choose");
        return;
      }

      const data = await res.json();
      await refreshTagsCollections();
      setImported(data);
      setMode("review");
    } catch {
      setError(t("import.errorImportRecipe"));
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
        setError(await readErrorMessage(res, t("import.errorImport")));
        setLoading(false);
        setMode("choose");
        return;
      }

      const data = await res.json();
      await refreshTagsCollections();
      setImported(data);
      setMode("review");
    } catch {
      setError(t("import.errorParse"));
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
        setError(await readErrorMessage(res, t("import.errorImport")));
        setLoading(false);
        setMode("choose");
        return;
      }

      const data = await res.json();
      await refreshTagsCollections();
      setImported(data);
      setMode("review");
    } catch {
      setError(t("import.errorPhoto"));
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
        <p className="text-muted-foreground">{t("import.importing")}</p>
      </div>
    );
  }

  // Review imported recipe
  if (mode === "review" && imported) {
    return (
      <div>
        <div className="mb-6 p-4 bg-secondary/50 rounded-lg flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("import.reviewMessage")}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setImported(null);
              setMode("choose");
            }}
          >
            {t("import.startOver")}
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
            &larr; {t("import.backToOptions")}
          </button>
        </div>
        <RecipeForm tags={tags} collections={collections} />
      </div>
    );
  }

  // Choose mode
  return (
    <div className="max-w-2xl space-y-5">
      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-scale-in">
          {error}
        </div>
      )}

      {/* --- Hero import card: URL + photo combined --- */}
      <div className="group/card relative overflow-hidden rounded-2xl border border-border/40 bg-card/80 shadow-sm transition-all duration-300 hover:border-border/60 hover:shadow-md hover:shadow-primary/[0.04]">
        {/* Decorative gradient glow at top of card */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />

        <div className="relative p-6 md:p-8">
          {/* Header with icon */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shadow-sm shadow-primary/[0.08] transition-transform duration-300 group-hover/card:scale-105">
              <Link className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight text-base">{t("import.fromUrl")}</h2>
              <p className="text-sm text-muted-foreground/70">
                {t("import.fromUrlDesc")}
              </p>
            </div>
          </div>

          {/* URL input row */}
          <div className="flex gap-2.5">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/recipe"
              className="flex-1 h-11 rounded-xl border-border/40 bg-background/60 text-base placeholder:text-muted-foreground/40 focus-visible:border-primary/40 focus-visible:ring-primary/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleImportUrl();
                }
              }}
            />
            <Button
              onClick={handleImportUrl}
              disabled={!url.trim()}
              className="h-11 px-5 rounded-xl shadow-sm shadow-primary/20 font-semibold tracking-tight"
            >
              {t("import.import")}
            </Button>
          </div>

          {/* "or upload a photo" inline divider */}
          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px bg-border/30" />
            <label className="group/photo inline-flex items-center gap-2 cursor-pointer rounded-full border border-border/40 bg-background/60 pl-3.5 pr-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary hover:shadow-sm hover:shadow-primary/[0.06]">
              <Camera className="h-4 w-4 transition-transform duration-200 group-hover/photo:scale-110" />
              {t("import.photo")}
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
            <div className="flex-1 h-px bg-border/30" />
          </div>
        </div>
      </div>

      {/* --- Paste text card --- */}
      <div className="group/paste rounded-2xl border border-border/30 bg-card/50 transition-all duration-300 hover:border-border/50 hover:shadow-sm hover:shadow-primary/[0.03]">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/[0.07] transition-transform duration-300 group-hover/paste:scale-105">
              <FileText className="h-4 w-4 text-primary/80" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight text-sm">{t("import.pasteText")}</h2>
              <p className="text-xs text-muted-foreground/60">
                {t("import.pasteTextDesc")}
              </p>
            </div>
          </div>

          {/* Textarea */}
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={t("import.pasteTextPlaceholder")}
            rows={5}
            className="rounded-xl border-border/30 bg-background/40 placeholder:text-muted-foreground/35 text-sm focus-visible:border-primary/30 focus-visible:ring-primary/15 resize-none"
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={handleImportText}
              disabled={!pasteText.trim()}
              variant="outline"
              className="rounded-xl border-border/40 hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary transition-all duration-200"
            >
              {t("import.parseRecipe")}
            </Button>
          </div>
        </div>
      </div>

      {/* --- Manual write: quiet text link --- */}
      <div className="text-center pt-1 pb-2">
        <button
          onClick={() => setMode("manual")}
          className="text-sm text-muted-foreground/60 hover:text-foreground transition-colors duration-200 inline-flex items-center gap-1.5"
        >
          <PenLine className="h-3.5 w-3.5" />
          {t("import.writeManually")}
        </button>
      </div>
    </div>
  );
}
