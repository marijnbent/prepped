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
    <section>
      <h2 className="text-2xl font-medium tracking-tight">{t("comments.title")}</h2>

      {canComment ? (
        <form onSubmit={submitComment} className="mt-6">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("comments.placeholder")}
            aria-label={t("comments.placeholder")}
            rows={3}
            maxLength={1000}
            className="min-h-24"
          />
          <div className="mt-2 flex flex-wrap items-center gap-0.5">
            {quickEmojis.map(({ emoji, label }) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                disabled={saving}
                className="inline-flex size-9 items-center justify-center rounded-full text-lg transition-colors hover:bg-secondary disabled:opacity-50"
                aria-label={label}
                title={label}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
            <Button type="submit" disabled={saving || !body.trim()} className="ml-auto">
              <Send />
              {saving ? t("form.saving") : t("comments.post")}
            </Button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </form>
      ) : (
        <a
          href={loginHref}
          className="mt-6 inline-flex rounded-full border-[1.5px] border-foreground px-[18px] py-[9px] text-sm font-medium transition-colors hover:bg-secondary"
        >
          {t("comments.login")}
        </a>
      )}

      {comments.length === 0 ? (
        <p className="mt-8 text-muted-foreground">{t("comments.empty")}</p>
      ) : (
        <div className="mt-8 divide-y divide-border border-t border-border">
          {comments.map((comment) => {
            const highlighted = highlightedId === comment.id;
            return (
              <article
                key={comment.id}
                id={`comment-${comment.id}`}
                className={`scroll-mt-24 py-5 transition-[border-color] ${
                  highlighted ? "border-l-[3px] border-l-highlight pl-4" : ""
                }`}
              >
                <p className="flex items-baseline gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{comment.authorName}</span>
                  <time className="shrink-0 text-muted-foreground tabular-nums">
                    {formatCommentDate(comment.createdAt)}
                  </time>
                </p>
                {comment.reaction && (
                  <p className="mt-2 text-lg leading-none">
                    {reactionText(comment.reaction)}
                  </p>
                )}
                {comment.body && <p className="mt-2 whitespace-pre-wrap leading-relaxed">{comment.body}</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
