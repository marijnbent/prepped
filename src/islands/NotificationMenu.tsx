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
  const [isDismissing, setIsDismissing] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isMutatingRef = useRef(false);

  async function load() {
    if (isMutatingRef.current) return;
    const res = await fetch("/api/notifications", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
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
    const wasUnread = !item.readAt;

    if (!item.readAt) {
      setUnread((current) => Math.max(0, current - 1));
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    }

    try {
      if (wasUnread) {
        await fetch(`/api/notifications/${item.id}/read`, {
          method: "POST",
          cache: "no-store",
          keepalive: true,
        });
      }
    } finally {
      window.location.href = item.href;
    }
  }

  async function dismissAll() {
    if (isDismissing || (items.length === 0 && unread === 0)) return;

    isMutatingRef.current = true;
    setIsDismissing(true);

    try {
      const res = await fetch("/api/notifications/dismiss-all", {
        method: "POST",
        cache: "no-store",
        keepalive: true,
      });

      if (!res.ok) {
        throw new Error("Failed to dismiss notifications");
      }

      setItems([]);
      setUnread(0);
    } catch (error) {
      console.error("[notifications] failed to dismiss", error);
    } finally {
      setIsDismissing(false);
      isMutatingRef.current = false;
      await load();
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-secondary"
        aria-label={t("notifications.title")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-highlight px-1.5 py-0.5 text-[10px] font-semibold leading-none text-highlight-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-[20px] border border-border bg-background shadow-[0_12px_32px_-12px_rgb(23_24_26/0.18)]">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <h2 className="font-medium text-lg leading-none tracking-tight">{t("notifications.title")}</h2>
            {items.length > 0 && (
              <button
                type="button"
                onClick={dismissAll}
                disabled={isDismissing}
                className="ml-auto rounded-full px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {t("notifications.dismissAll")}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {!loaded ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">{t("notifications.loading")}</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">{t("notifications.empty")}</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className="block w-full rounded-[14px] px-3 py-3 text-left transition-colors hover:bg-secondary"
                >
                  <span className="mb-1 flex items-start gap-2">
                    {item.reaction && <span aria-hidden="true" className="text-xs leading-5">{reactionEmoji(item.reaction)}</span>}
                    <span className="min-w-0 flex-1 text-sm leading-snug text-foreground">
                      <span className="font-medium text-foreground">{item.actorName}</span>{" "}
                      {t("notifications.commented")}{" "}
                      <span className="font-medium text-foreground">{item.recipeTitle}</span>
                    </span>
                    {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-highlight ring-1 ring-foreground/20" />}
                  </span>
                  {item.commentBody && (
                    <span className="line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                      {item.commentBody}
                    </span>
                  )}
                  <time className="mt-1.5 block text-[11px] text-muted-foreground">
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
