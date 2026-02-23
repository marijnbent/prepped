import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Image as ImageIcon } from "lucide-react";
import { t } from "@/lib/i18n";

const IMAGE_UPLOAD_TIMEOUT_MS = 120_000;
const IMAGE_MAX_EDGE = 1600;
const IMAGE_JPEG_QUALITY = 0.82;

interface Props {
  value?: string;
  onChange: (url: string) => void;
  subdir?: "recipes" | "cook-logs";
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

function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = IMAGE_UPLOAD_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json() as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // Ignore parse issues.
  }
  return `${t("upload.failed")} (HTTP ${response.status})`;
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
      IMAGE_JPEG_QUALITY,
    );
  });
}

function toJpgFileName(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return `${fileName}.jpg`;
  return `${fileName.slice(0, dot)}.jpg`;
}

async function normalizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const image = await loadImageFromFile(file);
    const maxEdge = Math.max(image.width, image.height);
    const scale = maxEdge > IMAGE_MAX_EDGE ? IMAGE_MAX_EDGE / maxEdge : 1;

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
    // Fallback to original file if client conversion fails.
    return file;
  }
}

export default function ImageUpload({ value, onChange, subdir = "recipes" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setError("");
    setUploading(true);

    const uploadFile = await normalizeImageForUpload(file);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("subdir", subdir);

    try {
      let res = await fetchWithTimeout("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      // Some deployment WAF/proxies block multipart uploads with 403; retry as JSON.
      if (res.status === 403) {
        const image = await fileToDataUrl(uploadFile);
        res = await fetchWithTimeout("/api/images/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, subdir, mimeType: uploadFile.type }),
        });
      }

      if (!res.ok) {
        setError(await readErrorMessage(res));
        setUploading(false);
        return;
      }

      const { full } = await res.json();
      onChange(full);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(`${t("upload.failed")} (timeout)`);
      } else {
        setError(t("upload.failed"));
      }
    }
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  const imageUrl = value
    ? value.startsWith("/")
      ? `/api/uploads${value}`
      : value
    : null;

  return (
    <div className="space-y-2">
      {imageUrl ? (
        <div className="relative inline-block">
          <img
            src={imageUrl}
            alt={t("upload.preview")}
            className="rounded-lg max-w-xs max-h-48 object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          {uploading ? (
            <p className="text-sm text-muted-foreground">{t("upload.uploading")}</p>
          ) : (
            <>
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {t("upload.dropHint")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("upload.fileTypes")}
              </p>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
