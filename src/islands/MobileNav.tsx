import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Plus, LogOut, Settings, ShoppingCart, BookOpen, Heart, Users } from "lucide-react";
import { t } from "@/lib/i18n";
import ThemeToggle from "./ThemeToggle";

interface Props {
  user?: { id: string; name: string; email: string } | null;
  authMode?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileNav({ user, authMode, open, onOpenChange }: Props) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72 bg-card/95 backdrop-blur-2xl border-border/30">
        <SheetTitle className="text-xl font-serif text-primary tracking-tight">Prepped</SheetTitle>
        <nav className="flex flex-col gap-1 mt-6">
          <a
            href="/cook-log"
            className="text-sm py-2.5 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-200 flex items-center gap-2.5"
            onClick={() => onOpenChange(false)}
          >
            <BookOpen className="h-4 w-4" />
            {t("nav.cookLog")}
          </a>
          <a
            href="/shopping-list"
            className="text-sm py-2.5 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-200 flex items-center gap-2.5"
            onClick={() => onOpenChange(false)}
          >
            <ShoppingCart className="h-4 w-4" />
            {t("nav.shoppingList")}
          </a>
          <a
            href="/users"
            className="text-sm py-2.5 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-200 flex items-center gap-2.5"
            onClick={() => onOpenChange(false)}
          >
            <Users className="h-4 w-4" />
            {t("nav.community")}
          </a>
          <a
            href="/favorites"
            className="text-sm py-2.5 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-200 flex items-center gap-2.5"
            onClick={() => onOpenChange(false)}
          >
            <Heart className="h-4 w-4" />
            {t("nav.favorites")}
          </a>
          {user ? (
            <>
              <div className="my-3 h-px bg-gradient-to-r from-border/40 to-transparent" />
              <a
                href="/profile"
                className="text-sm py-2.5 px-3 rounded-lg hover:bg-secondary/60 transition-all duration-200 flex items-center gap-2.5 text-muted-foreground"
                onClick={() => onOpenChange(false)}
              >
                <Settings className="h-4 w-4" />
                {t("profile.title")}
              </a>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-muted-foreground">{t("theme.toggle")}</span>
                <ThemeToggle />
              </div>
              <div className="my-1 h-px bg-gradient-to-r from-border/40 to-transparent" />
              <button
                onClick={handleLogout}
                className="text-sm py-2.5 px-3 rounded-lg hover:bg-secondary/60 transition-all duration-200 flex items-center gap-2.5 text-left text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <div className="my-3 h-px bg-gradient-to-r from-border/40 to-transparent" />
              <a
                href="/login"
                className="text-sm py-2.5 px-3 rounded-lg hover:bg-secondary/60 transition-all duration-200 text-primary"
                onClick={() => onOpenChange(false)}
              >
                {t("nav.login")}
              </a>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
