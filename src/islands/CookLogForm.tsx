import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Star } from "lucide-react";
import ImageUpload from "./ImageUpload";
import { t } from "@/lib/i18n";
import { getApiErrorMessage } from "@/lib/api-errors";

interface Props {
  recipeId: number;
  recipeSlug?: string;
  redirectTo?: string;
}

export default function CookLogForm({ recipeId, recipeSlug, redirectTo }: Props) {
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [photoUrl, setPhotoUrl] = useState("");
  const [cookedAt, setCookedAt] = useState(new Date().toISOString().split("T")[0]);
  const [hoverRating, setHoverRating] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/cook-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId,
          notes: notes || undefined,
          rating: rating || undefined,
          photoUrl: photoUrl || undefined,
          cookedAt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, t("form.errorSaveGeneral")));
        setSaving(false);
        return;
      }

      window.location.href = redirectTo || (recipeSlug ? `/recipes/${recipeSlug}` : "/cook-log");
    } catch {
      setError(t("common.error"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rating */}
      <div className="space-y-2">
        <Label>{t("cookLog.rating")}</Label>
        <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= (hoverRating || rating);
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n === rating ? 0 : n)}
                onMouseEnter={() => setHoverRating(n)}
                className="p-0.5 transition-transform hover:scale-110 active:scale-90"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >
                <Star
                  className={`h-6 w-6 transition-colors duration-150 ${
                    active
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/40 hover:text-muted-foreground"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Photo */}
      <div className="space-y-2">
        <Label>{t("cookLog.photo")}</Label>
        <ImageUpload value={photoUrl} onChange={setPhotoUrl} subdir="cook-logs" />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="cookNotes">{t("cookLog.notes")}</Label>
        <Textarea
          id="cookNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("form.cookNotesPlaceholder")}
          rows={3}
        />
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="cookedAt">{t("cookLog.date")}</Label>
        <Input
          id="cookedAt"
          type="date"
          value={cookedAt}
          onChange={(e) => setCookedAt(e.target.value)}
          className="w-40"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t("form.saving") : t("form.addCookLog")}
        </Button>
      </div>
    </form>
  );
}
