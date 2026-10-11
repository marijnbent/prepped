import { useState } from "react";
import { BookOpen, Search, Plus, ShoppingCart, Menu } from "lucide-react";
import { t } from "@/lib/i18n";
import MobileNav from "./MobileNav";

interface Props {
  user: { id: string; name: string; email: string };
  pathname: string;
  authMode?: string;
}

export default function MobileToolbar({ user, pathname, authMode }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden border-t border-border bg-background"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-5 h-14">
          {/* Recipes */}
          <a
            href="/recipes"
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive("/recipes") && !pathname.includes("/new") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <BookOpen className="w-5 h-5" strokeWidth={2} />
            <span className="text-[10px] leading-none font-medium">{t("nav.recipes")}</span>
          </a>

          {/* Search */}
          <a
            href="/recipes?search="
            className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors"
          >
            <Search className="w-5 h-5" strokeWidth={2} />
            <span className="text-[10px] leading-none font-medium">{t("common.search")}</span>
          </a>

          {/* New (center, prominent) */}
          <a
            href="/recipes/new"
            aria-label={t("nav.newRecipe")}
            className="flex items-center justify-center"
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground">
              <Plus className="w-5 h-5" strokeWidth={2} />
            </span>
          </a>

          {/* Shopping list */}
          <a
            href="/shopping-list"
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive("/shopping-list") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <ShoppingCart className="w-5 h-5" strokeWidth={2} />
            <span className="text-[10px] leading-none font-medium">{t("nav.shoppingList")}</span>
          </a>

          {/* More */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              moreOpen ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Menu className="w-5 h-5" strokeWidth={2} />
            <span className="text-[10px] leading-none font-medium">{t("nav.more")}</span>
          </button>
        </div>
      </nav>

      <MobileNav
        user={user}
        authMode={authMode}
        open={moreOpen}
        onOpenChange={setMoreOpen}
      />
    </>
  );
}
