import { useState } from "react";
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
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border/50 bg-background/80 backdrop-blur-2xl backdrop-saturate-150"
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
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
            <span className="text-[10px] leading-none font-medium">{t("nav.recipes")}</span>
          </a>

          {/* Search */}
          <a
            href="/recipes?search="
            className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="text-[10px] leading-none font-medium">{t("common.search")}</span>
          </a>

          {/* New (center, prominent) */}
          <a
            href="/recipes/new"
            className="flex items-center justify-center"
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </a>

          {/* Collections */}
          <a
            href="/collections"
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive("/collections") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
            </svg>
            <span className="text-[10px] leading-none font-medium">{t("nav.collections")}</span>
          </a>

          {/* More */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              moreOpen ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
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
