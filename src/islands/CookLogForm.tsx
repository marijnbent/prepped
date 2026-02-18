import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Star } from "lucide-react";
import ImageUpload from "./ImageUpload";

interface Props {
  recipeId: number;
  recipeSlug: string;
}

export default function CookLogForm({ recipeId, recipeSlug }: Props) {
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [photoUrl, setPhotoUrl] = useState("");
  const [cookedAt, setCookedAt] = useState(new Date().toISOString().split("T")[0]);
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
        setError(data.error?.toString() || "Failed to save");
        setSaving(false);
        return;
      }

      window.location.href = `/recipes/${recipeSlug}`;
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rating */}
      <div className="space-y-2">
        <Label>Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n === rating ? 0 : n)}
              className="p-0.5"
            >
              <Star
                className={`h-6 w-6 ${
                  n <= rating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Photo */}
      <div className="space-y-2">
        <Label>Photo</Label>
        <ImageUpload value={photoUrl} onChange={setPhotoUrl} subdir="cook-logs" />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="cookNotes">Notes</Label>
        <Textarea
          id="cookNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it turn out? Any modifications?"
          rows={3}
        />
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="cookedAt">Date</Label>
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
          {saving ? "Saving..." : "Add Cook Log"}
        </Button>
      </div>
    </form>
  );
}
