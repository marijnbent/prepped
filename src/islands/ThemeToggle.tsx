import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { t } from "@/lib/i18n";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  // Avoid hydration mismatch — render placeholder until mounted
  if (!mounted) {
    return (
      <button
        className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground"
        aria-label={t("theme.toggle")}
      >
        <span className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-200 active:scale-95"
      aria-label={dark ? t("theme.light") : t("theme.dark")}
    >
      {dark ? (
        // Sun icon
        <Sun className="w-[18px] h-[18px]" strokeWidth={2} />
      ) : (
        // Moon icon
        <Moon className="w-[18px] h-[18px]" strokeWidth={2} />
      )}
    </button>
  );
}
