import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { User, LogOut } from "lucide-react";

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
        className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-secondary/40 px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border/60 transition-all duration-200"
      >
        Login
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
    >
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-[13px]">{user.name || user.email}</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full pt-1 z-50">
          <div className="bg-card/95 backdrop-blur-xl border border-border/30 rounded-md p-1 shadow-md min-w-[160px]">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
