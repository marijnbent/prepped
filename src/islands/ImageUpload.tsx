import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Image as ImageIcon } from "lucide-react";

interface Props {
  value?: string;
  onChange: (url: string) => void;
  subdir?: "recipes" | "cook-logs";
}

export default function ImageUpload({ value, onChange, subdir = "recipes" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("subdir", subdir);

    try {
      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Upload failed");
        setUploading(false);
        return;
      }

      const { full } = await res.json();
      onChange(full);
    } catch {
      setError("Upload failed");
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
            alt="Upload preview"
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
            <p className="text-sm text-muted-foreground">Uploading...</p>
          ) : (
            <>
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drop an image here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPEG, PNG, or WebP (max 10MB)
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
