import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FolderOpen, LogOut, Settings, ShoppingCart, BookOpen, Heart, Users } from "lucide-react";
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

  const itemClass = "flex items-center gap-3 rounded-full px-3 py-2.5 transition-colors hover:bg-secondary";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72 gap-0 p-5">
        <SheetTitle className="px-3 text-sm font-normal text-muted-foreground">{t("nav.more")}</SheetTitle>
        <nav className="mt-4 flex flex-col gap-0.5">
          <a
            href="/cook-log"
            className={itemClass}
            onClick={() => onOpenChange(false)}
          >
            <BookOpen className="size-[18px]" strokeWidth={1.75} />
            {t("nav.cookLog")}
          </a>
          <a
            href="/shopping-list"
            className={itemClass}
            onClick={() => onOpenChange(false)}
          >
            <ShoppingCart className="size-[18px]" strokeWidth={1.75} />
            {t("nav.shoppingList")}
          </a>
          <a
            href="/collections"
            className={itemClass}
            onClick={() => onOpenChange(false)}
          >
            <FolderOpen className="size-[18px]" strokeWidth={1.75} />
            {t("nav.collections")}
          </a>
          <a
            href="/users"
            className={itemClass}
            onClick={() => onOpenChange(false)}
          >
            <Users className="size-[18px]" strokeWidth={1.75} />
            {t("nav.community")}
          </a>
          <a
            href="/favorites"
            className={itemClass}
            onClick={() => onOpenChange(false)}
          >
            <Heart className="size-[18px]" strokeWidth={1.75} />
            {t("nav.favorites")}
          </a>
          {user ? (
            <>
              <div className="my-3 border-t border-border" />
              <a
                href="/profile"
                className={itemClass}
                onClick={() => onOpenChange(false)}
              >
                <Settings className="size-[18px]" strokeWidth={1.75} />
                {t("profile.title")}
              </a>
              <div className="flex items-center justify-between py-1 pl-3">
                <span>{t("theme.toggle")}</span>
                <ThemeToggle />
              </div>
              <div className="my-3 border-t border-border" />
              <button
                onClick={handleLogout}
                className={`${itemClass} text-left`}
              >
                <LogOut className="size-[18px]" strokeWidth={1.75} />
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <div className="my-3 border-t border-border" />
              <a
                href="/login"
                className={itemClass}
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
