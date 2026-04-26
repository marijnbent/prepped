import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { t } from "@/lib/i18n";

type Reaction = "fire" | "water" | "spicy";

interface NotificationItem {
  id: number;
  readAt: string | Date | null;
  createdAt: string | Date;
  actorName: string;
  recipeTitle: string;
  commentBody: string | null;
  reaction: Reaction | null;
  href: string;
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function reactionEmoji(reaction: Reaction) {
  if (reaction === "fire") return "🔥";
  if (reaction === "water") return "💧💧💧";
  return "🌶️";
}

export default function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    const res = await fetch("/api/notifications", { headers: { Accept: "application/json" } });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.notifications || []);
    setUnread(data.unread || 0);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      setUnread((current) => Math.max(0, current - 1));
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date() } : entry));
      await fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
    }

    window.location.href = item.href;
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/60 transition-all duration-200 hover:bg-secondary/50 hover:text-foreground"
        aria-label={t("notifications.title")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground shadow-sm">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border/35 bg-card/95 shadow-xl shadow-black/10 backdrop-blur-2xl">
          <div className="border-b border-border/25 px-4 py-3">
            <h2 className="font-serif text-lg leading-none tracking-tight">{t("notifications.title")}</h2>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {!loaded ? (
              <p className="px-3 py-6 text-sm text-muted-foreground/60">{t("notifications.loading")}</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground/60">{t("notifications.empty")}</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className="block w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary/60"
                >
                  <span className="mb-1 flex items-start gap-2">
                    {item.reaction && <span aria-hidden="true" className="text-xs leading-5">{reactionEmoji(item.reaction)}</span>}
                    <span className="min-w-0 flex-1 text-sm leading-snug text-foreground/80">
                      <span className="font-medium text-foreground">{item.actorName}</span>{" "}
                      {t("notifications.commented")}{" "}
                      <span className="font-medium text-foreground">{item.recipeTitle}</span>
                    </span>
                    {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </span>
                  {item.commentBody && (
                    <span className="line-clamp-2 block text-xs leading-relaxed text-muted-foreground/65">
                      {item.commentBody}
                    </span>
                  )}
                  <time className="mt-1.5 block text-[11px] text-muted-foreground/40">
                    {formatDate(item.createdAt)}
                  </time>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
