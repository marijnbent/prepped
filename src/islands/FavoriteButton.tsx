import { useState } from "react";
import { Heart } from "lucide-react";

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
      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 shadow-sm transition-all duration-200 hover:scale-110 hover:border-rose-300 active:scale-95"
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={`w-4 h-4 transition-colors duration-200 ${
          favorited
            ? "fill-rose-500 text-rose-500"
            : "fill-none text-muted-foreground hover:text-rose-400"
        }`}
      />
    </button>
  );
}
