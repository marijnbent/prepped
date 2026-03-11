import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Globe, MessageCircle, ShoppingBasket, Check } from "lucide-react";
import { t } from "@/lib/i18n";
import { getApiErrorMessage } from "@/lib/api-errors";

interface Props {
  importPrompt: string;
  chatPrompt: string;
  shoppingPrompt: string;
  cookingSuppliesExpandedByDefault: boolean;
}

export default function ProfileForm({
  importPrompt: initialImport,
  chatPrompt: initialChat,
  shoppingPrompt: initialShopping,
  cookingSuppliesExpandedByDefault: initialCookingSuppliesExpandedByDefault,
}: Props) {
  const cookingSuppliesToggleRef = useRef<HTMLButtonElement | null>(null);
  const [importPrompt, setImportPrompt] = useState(initialImport);
  const [chatPrompt, setChatPrompt] = useState(initialChat);
  const [shoppingPrompt, setShoppingPrompt] = useState(initialShopping);
  const [cookingSuppliesExpandedByDefault, setCookingSuppliesExpandedByDefault] = useState(initialCookingSuppliesExpandedByDefault);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importPrompt, chatPrompt, shoppingPrompt, cookingSuppliesExpandedByDefault }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, t("common.error")));
        setSaving(false);
        return;
      }

      setSaved(true);
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t("common.error"));
      setSaving(false);
    }
  }

  function launchPurpleConfetti() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const origin = cookingSuppliesToggleRef.current?.getBoundingClientRect();
    if (!origin) return;

    const centerX = origin.left + origin.width / 2;
    const centerY = origin.top + origin.height / 2;
    const colors = ["#7c3aed", "#8b5cf6", "#a855f7", "#c084fc", "#ddd6fe"];
    const hearts = ["♥", "❤", "♡"];
    const bursts = [
      { count: 28, minDistance: 55, maxDistance: 105, minDuration: 1400, maxDuration: 1900, spread: 220, rise: 55 },
      { count: 24, minDistance: 80, maxDistance: 150, minDuration: 1800, maxDuration: 2500, spread: 260, rise: 80 },
    ];

    for (const burst of bursts) {
      for (let i = 0; i < burst.count; i += 1) {
      const piece = document.createElement("span");
      const angle = (-burst.spread / 2 + Math.random() * burst.spread) * (Math.PI / 180);
      const distance = burst.minDistance + Math.random() * (burst.maxDistance - burst.minDistance);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - (burst.rise + Math.random() * 55);
      const size = 12 + Math.random() * 12;
      const rotation = Math.random() * 720 - 360;

      piece.setAttribute("aria-hidden", "true");
      piece.textContent = hearts[i % hearts.length];
      piece.style.position = "fixed";
      piece.style.left = `${centerX}px`;
      piece.style.top = `${centerY}px`;
      piece.style.fontSize = `${size}px`;
      piece.style.lineHeight = "1";
      piece.style.color = colors[i % colors.length];
      piece.style.pointerEvents = "none";
      piece.style.userSelect = "none";
      piece.style.zIndex = "9999";
      piece.style.boxShadow = "0 0 12px rgba(168, 85, 247, 0.35)";
      document.body.appendChild(piece);

      piece.animate(
        [
          { transform: "translate(-50%, -50%) translate3d(0, 0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate(-50%, -50%) translate3d(${dx * 0.72}px, ${dy * 0.72}px, 0) rotate(${rotation * 0.65}deg)`, opacity: 1, offset: 0.68 },
          { transform: `translate(-50%, -50%) translate3d(${dx}px, ${dy}px, 0) rotate(${rotation}deg)`, opacity: 0, offset: 1 },
        ],
        {
          duration: burst.minDuration + Math.random() * (burst.maxDuration - burst.minDuration),
          easing: "cubic-bezier(0.2, 0.8, 0.25, 1)",
          fill: "forwards",
        }
      ).finished.finally(() => piece.remove());
    }
    }
  }

  function handleCookingSuppliesToggle(checked: boolean | "indeterminate") {
    const nextValue = checked === true;
    setCookingSuppliesExpandedByDefault(nextValue);

    if (nextValue && !cookingSuppliesExpandedByDefault) {
      launchPurpleConfetti();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            {t("profile.groupPrompts")}
          </h2>
        </div>

        {/* Import instructions card */}
        <div className="bg-card/50 border border-border/30 rounded-2xl p-6 space-y-4 transition-colors duration-200 hover:border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">{t("profile.importPrompt")}</h2>
              <p className="text-sm text-muted-foreground/60">{t("profile.importPromptDesc")}</p>
            </div>
          </div>
          <Textarea
            id="importPrompt"
            value={importPrompt}
            onChange={(e) => setImportPrompt(e.target.value)}
            placeholder={t("profile.importPromptPlaceholder")}
            rows={3}
            maxLength={500}
            className="resize-none"
          />
        </div>

        {/* Chat instructions card */}
        <div className="bg-card/50 border border-border/30 rounded-2xl p-6 space-y-4 transition-colors duration-200 hover:border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">{t("profile.chatPrompt")}</h2>
              <p className="text-sm text-muted-foreground/60">{t("profile.chatPromptDesc")}</p>
            </div>
          </div>
          <Textarea
            id="chatPrompt"
            value={chatPrompt}
            onChange={(e) => setChatPrompt(e.target.value)}
            placeholder={t("profile.chatPromptPlaceholder")}
            rows={3}
            maxLength={500}
            className="resize-none"
          />
        </div>

        {/* Shopping list instructions card */}
        <div className="bg-card/50 border border-border/30 rounded-2xl p-6 space-y-4 transition-colors duration-200 hover:border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
              <ShoppingBasket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">{t("profile.shoppingPrompt")}</h2>
              <p className="text-sm text-muted-foreground/60">{t("profile.shoppingPromptDesc")}</p>
            </div>
          </div>
          <Textarea
            id="shoppingPrompt"
            value={shoppingPrompt}
            onChange={(e) => setShoppingPrompt(e.target.value)}
            placeholder={t("profile.shoppingPromptPlaceholder")}
            rows={3}
            maxLength={500}
            className="resize-none"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            {t("profile.groupOther")}
          </h2>
        </div>

        <div className="bg-card/50 border border-border/30 rounded-2xl p-6 transition-colors duration-200 hover:border-border/50">
          <div className="flex items-start gap-3">
            <Checkbox
              id="cookingSuppliesExpandedByDefault"
              ref={cookingSuppliesToggleRef}
              checked={cookingSuppliesExpandedByDefault}
              onCheckedChange={handleCookingSuppliesToggle}
              className="mt-1 border-violet-300/80 focus-visible:border-violet-500 focus-visible:ring-violet-300/40 data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600 data-[state=checked]:text-white dark:border-violet-400/40 dark:data-[state=checked]:border-violet-400 dark:data-[state=checked]:bg-violet-400 dark:data-[state=checked]:text-violet-950"
            />
            <div className="space-y-1.5">
              <Label htmlFor="cookingSuppliesExpandedByDefault" className="cursor-pointer text-base font-semibold">
                {t("profile.cookingSuppliesExpandedByDefault")}
              </Label>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving} className="shadow-sm shadow-primary/20">
          {saving ? t("common.loading") : t("common.save")}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 animate-fade-up">
            <Check className="h-3.5 w-3.5" />
            {t("profile.saved")}
          </span>
        )}
      </div>
    </form>
  );
}
