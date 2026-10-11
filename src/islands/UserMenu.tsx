import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { User, LogOut, Settings } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  user?: { id: string; name: string; email: string } | null;
  authMode?: string;
}

export default function UserMenu({ user, authMode }: Props) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openMenu() {
    clearCloseTimer();
    setOpen(true);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 150);
  }

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  if (!user) {
    return (
      <a
        href="/login"
        className="inline-flex h-10 items-center rounded-full border-[1.5px] border-foreground px-[18px] text-sm font-medium transition-colors hover:bg-secondary"
      >
        {t("nav.login")}
      </a>
    );
  }

  async function handleLogout() {
    const url = authMode === "simple" ? "/api/auth/simple-logout" : "/api/auth/sign-out";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) return;
    window.location.href = "/";
  }

  return (
    <div
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        aria-expanded={open}
        onClick={openMenu}
      >
        <User className="size-4" strokeWidth={1.75} />
        <span>{user.name || user.email}</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full pt-1 z-50">
          <div className="min-w-[180px] rounded-[20px] border border-border bg-background p-1.5 shadow-[0_12px_32px_-12px_rgb(23_24_26/0.18)]">
            <a
              href="/profile"
              className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <Settings className="h-4 w-4" />
              {t("profile.title")}
            </a>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors hover:bg-secondary cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              {t("nav.logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
