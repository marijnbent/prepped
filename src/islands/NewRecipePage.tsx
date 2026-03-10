import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Link, FileText, PenLine, Camera } from "lucide-react";
import RecipeForm from "./RecipeForm";
import { t } from "@/lib/i18n";

type Mode = "choose" | "manual" | "importing" | "review";
type UrlImportMode = "direct" | "scrape" | "scrape-super";

const PHOTO_UPLOAD_TIMEOUT_MS = 120_000;
const PHOTO_MAX_EDGE = 1600;
const PHOTO_JPEG_QUALITY = 0.82;
const PHOTO_MAX_FILES = 5;

interface Props {
  tags: { id: number; name: string }[];
  collections: { id: number; name: string }[];
}

interface ImportApiError {
  message: string;
  code?: string;
  nextMode?: UrlImportMode;
}

function isUrlImportMode(value: unknown): value is UrlImportMode {
  return value === "direct" || value === "scrape" || value === "scrape-super";
}

async function readError(response: Response, fallback: string): Promise<ImportApiError> {
  try {
    const data = await response.json() as { error?: unknown; code?: unknown; nextMode?: unknown };
    if (typeof data.error === "string" && data.error.trim().length > 0) {
      return {
        message: data.error,
        code: typeof data.code === "string" ? data.code : undefined,
        nextMode: isUrlImportMode(data.nextMode) ? data.nextMode : undefined,
      };
    }
  } catch {
    // Non-JSON responses can happen on unexpected server errors.
  }

  return {
    message: `${fallback} (HTTP ${response.status})`,
  };
}

function importStageLabel(stage: UrlImportMode | null) {
  if (stage === "direct") return t("import.progressDirect");
  if (stage === "scrape") return t("import.progressScrape");
  if (stage === "scrape-super") return t("import.progressScrapeSuper");
  return t("import.importing");
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read file"));
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = PHOTO_UPLOAD_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode image"));
    };
    img.src = objectUrl;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode image"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      PHOTO_JPEG_QUALITY,
    );
  });
}

function toJpgFileName(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return `${fileName}.jpg`;
  return `${fileName.slice(0, dot)}.jpg`;
}

async function normalizePhotoForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const image = await loadImageFromFile(file);
    const maxEdge = Math.max(image.width, image.height);
    const scale = maxEdge > PHOTO_MAX_EDGE ? PHOTO_MAX_EDGE / maxEdge : 1;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpegBlob = await canvasToJpegBlob(canvas);

    return new File([jpegBlob], toJpgFileName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // If client-side conversion fails, fall back to original file.
    return file;
  }
}

async function normalizePhotosForUpload(files: File[]) {
  return Promise.all(files.map((file) => normalizePhotoForUpload(file)));
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
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [urlImportStage, setUrlImportStage] = useState<UrlImportMode | null>(null);

  async function handleImportUrl() {
    if (!url.trim()) return;
    setError("");
    setLoading(true);
    setMode("importing");
    setUrlImportStage("direct");

    try {
      const seenModes = new Set<UrlImportMode>();
      let currentMode: UrlImportMode | null = "direct";

      while (currentMode && !seenModes.has(currentMode)) {
        seenModes.add(currentMode);
        setUrlImportStage(currentMode);

        const res = await fetch("/api/recipes/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, mode: currentMode }),
        });

        if (res.ok) {
          const data = await res.json();
          await refreshTagsCollections();
          setImported(data);
          setMode("review");
          setLoading(false);
          setUrlImportStage(null);
          return;
        }

        const parsed = await readError(res, t("import.errorImport"));
        if (parsed.code === "SCRAPE_BLOCKED" && parsed.nextMode) {
          currentMode = parsed.nextMode;
          continue;
        }

        setError(parsed.message);
        setLoading(false);
        setMode("choose");
        setUrlImportStage(null);
        return;
      }

      setError(t("import.errorImport"));
      setMode("choose");
    } catch {
      setError(t("import.errorImportRecipe"));
      setMode("choose");
    }
    setUrlImportStage(null);
    setLoading(false);
  }

  async function handleImportText() {
    if (!pasteText.trim()) return;
    setError("");
    setLoading(true);
    setMode("importing");
    setUrlImportStage(null);

    try {
      const res = await fetch("/api/recipes/import-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });

      if (!res.ok) {
        setError((await readError(res, t("import.errorImport"))).message);
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

  async function handleImportPhoto(files: File[]) {
    if (files.length === 0) return;
    if (files.length > PHOTO_MAX_FILES) {
      setError(t("import.errorTooManyPhotos"));
      return;
    }

    setError("");
    setLoading(true);
    setMode("importing");
    setUrlImportStage(null);

    try {
      const uploadFiles = await normalizePhotosForUpload(files);
      const formData = new FormData();
      for (const file of uploadFiles) {
        formData.append("photo", file);
      }

      let res = await fetchWithTimeout("/api/recipes/import-photo", {
        method: "POST",
        body: formData,
      });

      // Some deployment WAF/proxies block multipart uploads with 403; retry as JSON.
      if (res.status === 403) {
        const photos = await Promise.all(uploadFiles.map(fileToDataUrl));
        res = await fetchWithTimeout("/api/recipes/import-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photos }),
        });
      }

      if (!res.ok) {
        setError((await readError(res, t("import.errorImport"))).message);
        setLoading(false);
        setMode("choose");
        return;
      }

      const data = await res.json();
      await refreshTagsCollections();
      setImported(data);
      setMode("review");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(t("import.errorTimeout"));
      } else {
        setError(t("import.errorPhoto"));
      }
      setMode("choose");
    }
    setLoading(false);
  }

  function handlePhotoSelection(files: File[]) {
    if (files.length === 0) return;

    const merged = [...photoFiles, ...files];
    if (merged.length > PHOTO_MAX_FILES) {
      setError(t("import.errorTooManyPhotos"));
      setPhotoFiles(merged.slice(0, PHOTO_MAX_FILES));
      return;
    }

    setError("");
    setPhotoFiles(merged);
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
        <p className="text-muted-foreground">{importStageLabel(urlImportStage)}</p>
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
            imageProvider: imported.imageProvider,
            imageAuthorName: imported.imageAuthorName || "",
            imageAuthorUrl: imported.imageAuthorUrl || "",
            imageSourceUrl: imported.imageSourceUrl || "",
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
              {photoFiles.length > 0 ? t("import.addSecondPhoto") : t("import.photo")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  handlePhotoSelection(files);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="flex-1 h-px bg-border/30" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground/70 text-center">
            {t("import.photoCountHint")}
          </p>
          {photoFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">
                {photoFiles.length}/{PHOTO_MAX_FILES} {t("import.photosSelected")}
              </span>
              <Button
                onClick={() => handleImportPhoto(photoFiles)}
                size="sm"
                className="h-8 rounded-lg"
              >
                {t("import.import")}
              </Button>
              <Button
                onClick={() => setPhotoFiles([])}
                size="sm"
                variant="ghost"
                className="h-8 rounded-lg"
              >
                {t("import.startOver")}
              </Button>
            </div>
          )}
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
