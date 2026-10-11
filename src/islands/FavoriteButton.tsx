import { useState } from "react";
import { Heart } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  recipeId: number;
  initialFavorited: boolean;
}

export default function FavoriteButton({ recipeId, initialFavorited }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    const prev = favorited;
    setFavorited(!prev); // optimistic

    try {
      const res = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId }),
      });
      if (!res.ok) {
        setFavorited(prev); // revert
      } else {
        const data = await res.json();
        setFavorited(data.favorited);
      }
    } catch {
      setFavorited(prev); // revert
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className={`inline-flex items-center justify-center h-10 w-10 rounded-full text-xs font-medium border transition-colors ${
        favorited
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-transparent text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
      }`}
      aria-label={favorited ? t("recipe.unfavorite") : t("recipe.favorite")}
    >
      <Heart
        className={`w-4 h-4 transition-colors duration-200 ${
          favorited ? "fill-current" : ""
        }`}
      />
      <span className="sr-only">{favorited ? t("recipe.unfavorite") : t("recipe.favorite")}</span>
    </button>
  );
}
