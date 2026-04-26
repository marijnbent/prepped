import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { getApiErrorMessage } from "@/lib/api-errors";

type Reaction = "fire" | "water" | "spicy";

interface Comment {
  id: number;
  body: string | null;
  reaction: Reaction | null;
  createdAt: string | Date;
  authorId: string;
  authorName: string;
}

interface Props {
  recipeId: number;
  initialComments: Comment[];
  canComment: boolean;
  loginHref: string;
}

const quickEmojis = [
  { emoji: "💦", label: t("comments.reactionSplash") },
  { emoji: "🔥", label: t("comments.reactionFire") },
  { emoji: "🌶️", label: t("comments.reactionSpicy") },
  { emoji: "😋", label: t("comments.reactionYum") },
  { emoji: "🫠", label: t("comments.reactionMelting") },
  { emoji: "🤤", label: t("comments.reactionDrool") },
  { emoji: "✨", label: t("comments.reactionSparkle") },
  { emoji: "👌", label: t("comments.reactionPerfect") },
];

const legacyReactionEmoji: Record<Reaction, string> = {
  fire: "🔥",
  water: "💦",
  spicy: "🌶️",
};

function formatCommentDate(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function reactionText(reaction: Reaction) {
  return legacyReactionEmoji[reaction] || "";
}

export default function RecipeComments({ recipeId, initialComments, canComment, loginHref }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const highlightedId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const match = window.location.hash.match(/^#comment-(\d+)$/);
    return match ? Number(match[1]) : null;
  }, []);

  useEffect(() => {
    if (!highlightedId) return;
    document.getElementById(`comment-${highlightedId}`)?.scrollIntoView({ block: "center" });
  }, [highlightedId]);

  async function submit(payload: { body?: string; reaction?: Reaction }) {
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/recipes/${recipeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(getApiErrorMessage(data, t("comments.error")));
        setSaving(false);
        return;
      }

      setComments((current) => [data, ...current]);
      setBody("");
    } catch {
      setError(t("comments.error"));
    } finally {
      setSaving(false);
    }
  }

  function submitComment(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    submit({ body: trimmed });
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    const prefix = body.slice(0, start);
    const suffix = body.slice(end);
    const needsLeadingSpace = prefix.length > 0 && !/\s$/.test(prefix);
    const needsTrailingSpace = suffix.length > 0 && !/^\s/.test(suffix);
    const insertion = `${needsLeadingSpace ? " " : ""}${emoji}${needsTrailingSpace ? " " : ""}`;
    const next = `${prefix}${insertion}${suffix}`.slice(0, 1000);
    const caret = Math.min(1000, prefix.length + insertion.length);

    setBody(next);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(caret, caret);
    });
  }

  return (
    <section className="space-y-5">
      <h2 className="font-serif text-2xl tracking-tight flex items-center gap-3">
        {t("comments.title")}
        <span className="flex-1 h-px bg-gradient-to-r from-border/40 to-transparent" />
      </h2>

      {canComment ? (
        <div className="rounded-2xl bg-card/60 border border-border/25 p-5 backdrop-blur-sm space-y-4">
          <form onSubmit={submitComment} className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-input/80 bg-secondary/30 shadow-xs transition-all focus-within:border-primary/40 focus-within:bg-background focus-within:ring-[3px] focus-within:ring-primary/15 hover:border-input hover:bg-secondary/40">
              <Textarea
                ref={textareaRef}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t("comments.placeholder")}
                rows={3}
                maxLength={1000}
                className="min-h-24 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:bg-transparent hover:bg-transparent"
              />
              <div className="flex flex-wrap items-center gap-1 border-t border-border/20 px-2.5 py-2">
                {quickEmojis.map(({ emoji, label }) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    disabled={saving}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-lg transition-all hover:bg-background/80 hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 active:scale-95 disabled:opacity-50"
                    aria-label={label}
                    title={label}
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={saving || !body.trim()} size="sm">
              <Send className="h-3.5 w-3.5" />
              {saving ? t("form.saving") : t("comments.post")}
            </Button>
          </form>
        </div>
      ) : (
        <a
          href={loginHref}
          className="inline-flex rounded-full border border-border/35 bg-secondary/45 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {t("comments.login")}
        </a>
      )}

      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">{t("comments.empty")}</p>
        ) : (
          comments.map((comment) => {
            const highlighted = highlightedId === comment.id;
            return (
              <article
                key={comment.id}
                id={`comment-${comment.id}`}
                className={`scroll-mt-24 rounded-2xl border p-4 transition-colors ${
                  highlighted
                    ? "border-primary/45 bg-primary/10"
                    : "border-border/20 bg-card/50 hover:border-border/35 hover:bg-card/70"
                }`}
              >
                <div className="mb-2 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {comment.authorName.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground/75">{comment.authorName}</span>
                  </span>
                  <time className="ml-auto shrink-0 text-xs text-muted-foreground/40 tabular-nums">
                    {formatCommentDate(comment.createdAt)}
                  </time>
                </div>
                {comment.reaction && (
                  <p className="mb-2 text-lg leading-none">
                    {reactionText(comment.reaction)}
                  </p>
                )}
                {comment.body && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/70">{comment.body}</p>}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
