import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Globe, MessageCircle, ShoppingBasket, Check } from "lucide-react";
import { t } from "@/lib/i18n";
import { getApiErrorMessage } from "@/lib/api-errors";

interface Props {
  importPrompt: string;
  chatPrompt: string;
  shoppingPrompt: string;
}

export default function ProfileForm({ importPrompt: initialImport, chatPrompt: initialChat, shoppingPrompt: initialShopping }: Props) {
  const [importPrompt, setImportPrompt] = useState(initialImport);
  const [chatPrompt, setChatPrompt] = useState(initialChat);
  const [shoppingPrompt, setShoppingPrompt] = useState(initialShopping);
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
        body: JSON.stringify({ importPrompt, chatPrompt, shoppingPrompt }),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
