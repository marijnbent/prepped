import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2, PenLine } from "lucide-react";
import RecipeForm from "./RecipeForm";
import { t } from "@/lib/i18n";
import { normalizeImageProvider } from "@/lib/image-provider";

type Mode = "choose" | "manual" | "importing" | "review";
type UrlImportMode = "direct" | "browser" | "browser-advanced";

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
  return value === "direct" || value === "browser" || value === "browser-advanced";
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
  if (stage === "browser") return t("import.progressBrowser");
  if (stage === "browser-advanced") return t("import.progressBrowserAdvanced");
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
      <div role="status" className="flex items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="size-5 shrink-0 animate-spin" />
        <p>{importStageLabel(urlImportStage)}</p>
      </div>
    );
  }

  // Review imported recipe
  if (mode === "review" && imported) {
    return (
      <div>
        <div className="mb-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[20px] bg-secondary py-3 pl-5 pr-3">
          <p className="text-sm">{t("import.reviewMessage")}</p>
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-border"
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
            cookingSupplies: imported.cookingSupplies || [],
            steps: imported.steps || [],
            servings: imported.servings,
            prepTime: imported.prepTime,
            cookTime: imported.cookTime,
            difficulty: imported.difficulty,
            sourceUrl: imported.sourceUrl || url || "",
            videoUrl: imported.videoUrl || "",
            imageUrl: imported.imageUrl || "",
            imageProvider: normalizeImageProvider(imported.imageProvider),
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
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("import.backToOptions")}
        </button>
        <RecipeForm tags={tags} collections={collections} />
      </div>
    );
  }

  // Choose mode
  return (
    <div className="max-w-2xl">
      {error && (
        <p role="alert" className="mb-8 rounded-[20px] border border-destructive/40 px-5 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="pb-10">
        <h2 className="text-2xl font-medium tracking-tight">
          <label htmlFor="importUrl">{t("import.fromUrl")}</label>
        </h2>
        <p className="mt-1 text-muted-foreground">{t("import.fromUrlDesc")}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Input
            id="importUrl"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/recipe"
            className="h-12 flex-1 px-5 text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleImportUrl();
              }
            }}
          />
          <Button size="lg" onClick={handleImportUrl} disabled={!url.trim()}>
            {t("import.import")}
          </Button>
        </div>
      </section>

      <section className="border-t border-border py-10">
        <h2 className="text-2xl font-medium tracking-tight">{t("import.photo")}</h2>
        <p className="mt-1 text-muted-foreground">{t("import.fromPhotoDesc")}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <label className="relative inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-foreground px-[18px] text-sm font-medium transition-colors hover:bg-secondary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-ring">
            <Camera className="size-4" />
            {photoFiles.length > 0 ? t("import.addSecondPhoto") : t("import.upload")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                handlePhotoSelection(files);
                e.target.value = "";
              }}
            />
          </label>
          {photoFiles.length > 0 && (
            <>
              <Button onClick={() => handleImportPhoto(photoFiles)}>{t("import.import")}</Button>
              <Button onClick={() => setPhotoFiles([])} variant="ghost">
                {t("import.startOver")}
              </Button>
            </>
          )}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {photoFiles.length > 0
            ? `${photoFiles.length}/${PHOTO_MAX_FILES} ${t("import.photosSelected")}`
            : t("import.photoCountHint")}
        </p>
      </section>

      <section className="border-t border-border py-10">
        <h2 className="text-2xl font-medium tracking-tight">
          <label htmlFor="importText">{t("import.pasteText")}</label>
        </h2>
        <p className="mt-1 text-muted-foreground">{t("import.pasteTextDesc")}</p>
        <Textarea
          id="importText"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={t("import.pasteTextPlaceholder")}
          rows={6}
          className="mt-5 resize-none"
        />
        <Button onClick={handleImportText} disabled={!pasteText.trim()} variant="outline" className="mt-3">
          {t("import.parseRecipe")}
        </Button>
      </section>

      <section className="border-t border-border pt-10">
        <h2 className="text-2xl font-medium tracking-tight">{t("import.writeManually")}</h2>
        <p className="mt-1 text-muted-foreground">{t("import.writeManuallyDesc")}</p>
        <Button onClick={() => setMode("manual")} variant="outline" className="mt-5">
          <PenLine />
          {t("import.start")}
        </Button>
      </section>
    </div>
  );
}
