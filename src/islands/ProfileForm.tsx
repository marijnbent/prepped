import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Copy, Trash2, ExternalLink } from "lucide-react";
import { t } from "@/lib/i18n";
import { getApiErrorMessage } from "@/lib/api-errors";

interface Props {
  importPrompt: string;
  chatPrompt: string;
  shoppingPrompt: string;
  cookingSuppliesExpandedByDefault: boolean;
  dirkSecretModeEnabled: boolean;
  apiTokenPreview: string;
  apiTokenCreatedAt: string;
  apiTokenLastUsedAt: string;
}

export default function ProfileForm({
  importPrompt: initialImport,
  chatPrompt: initialChat,
  shoppingPrompt: initialShopping,
  cookingSuppliesExpandedByDefault: initialCookingSuppliesExpandedByDefault,
  dirkSecretModeEnabled: initialDirkSecretModeEnabled,
  apiTokenPreview: initialApiTokenPreview,
  apiTokenCreatedAt: initialApiTokenCreatedAt,
  apiTokenLastUsedAt: initialApiTokenLastUsedAt,
}: Props) {
  const cookingSuppliesToggleRef = useRef<HTMLButtonElement | null>(null);
  const dirkSecretToggleRef = useRef<HTMLButtonElement | null>(null);
  const [importPrompt, setImportPrompt] = useState(initialImport);
  const [chatPrompt, setChatPrompt] = useState(initialChat);
  const [shoppingPrompt, setShoppingPrompt] = useState(initialShopping);
  const [cookingSuppliesExpandedByDefault, setCookingSuppliesExpandedByDefault] = useState(initialCookingSuppliesExpandedByDefault);
  const [dirkSecretModeEnabled, setDirkSecretModeEnabled] = useState(initialDirkSecretModeEnabled);
  const [apiTokenPreview, setApiTokenPreview] = useState(initialApiTokenPreview);
  const [apiTokenCreatedAt, setApiTokenCreatedAt] = useState(initialApiTokenCreatedAt);
  const [apiTokenLastUsedAt, setApiTokenLastUsedAt] = useState(initialApiTokenLastUsedAt);
  const [rawApiToken, setRawApiToken] = useState("");
  const [apiTokenBusy, setApiTokenBusy] = useState(false);
  const [apiTokenError, setApiTokenError] = useState("");
  const [apiTokenCopied, setApiTokenCopied] = useState(false);
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
        body: JSON.stringify({ importPrompt, chatPrompt, shoppingPrompt, cookingSuppliesExpandedByDefault, dirkSecretModeEnabled }),
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

  function launchYellowConfetti() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const origin = dirkSecretToggleRef.current?.getBoundingClientRect();
    if (!origin) return;

    const centerX = origin.left + origin.width / 2;
    const centerY = origin.top + origin.height / 2;
    const colors = ["#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7"];
    const pieces = ["✦", "★", "✶", "✹"];
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
        piece.textContent = pieces[i % pieces.length];
        piece.style.position = "fixed";
        piece.style.left = `${centerX}px`;
        piece.style.top = `${centerY}px`;
        piece.style.fontSize = `${size}px`;
        piece.style.lineHeight = "1";
        piece.style.color = colors[i % colors.length];
        piece.style.pointerEvents = "none";
        piece.style.userSelect = "none";
        piece.style.zIndex = "9999";
        piece.style.boxShadow = "0 0 14px rgba(251, 191, 36, 0.4)";
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

  function handleDirkSecretToggle(checked: boolean | "indeterminate") {
    const nextValue = checked === true;
    setDirkSecretModeEnabled(nextValue);

    if (nextValue && !dirkSecretModeEnabled) {
      launchYellowConfetti();
    }
  }

  function formatDateTime(value: string) {
    if (!value) return "";

    try {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  async function handleGenerateApiToken() {
    setApiTokenBusy(true);
    setApiTokenError("");
    setApiTokenCopied(false);

    try {
      const res = await fetch("/api/profile/api-token", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        setApiTokenError(getApiErrorMessage(data, t("common.error")));
        setApiTokenBusy(false);
        return;
      }

      setRawApiToken(data.token || "");
      setApiTokenPreview(data.preview || "");
      setApiTokenCreatedAt(data.createdAt || "");
      setApiTokenLastUsedAt(data.lastUsedAt || "");
      setApiTokenBusy(false);
    } catch {
      setApiTokenError(t("common.error"));
      setApiTokenBusy(false);
    }
  }

  async function handleRevokeApiToken() {
    setApiTokenBusy(true);
    setApiTokenError("");
    setApiTokenCopied(false);

    try {
      const res = await fetch("/api/profile/api-token", {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setApiTokenError(getApiErrorMessage(data, t("common.error")));
        setApiTokenBusy(false);
        return;
      }

      setRawApiToken("");
      setApiTokenPreview("");
      setApiTokenCreatedAt("");
      setApiTokenLastUsedAt("");
      setApiTokenBusy(false);
    } catch {
      setApiTokenError(t("common.error"));
      setApiTokenBusy(false);
    }
  }

  async function handleCopyApiToken() {
    if (!rawApiToken) return;

    try {
      await navigator.clipboard.writeText(rawApiToken);
      setApiTokenCopied(true);
      window.setTimeout(() => setApiTokenCopied(false), 2000);
    } catch {
      setApiTokenError(t("common.error"));
    }
  }

  const promptFields = [
    {
      id: "importPrompt",
      label: t("profile.importPrompt"),
      description: t("profile.importPromptDesc"),
      placeholder: t("profile.importPromptPlaceholder"),
      value: importPrompt,
      onChange: setImportPrompt,
    },
    {
      id: "chatPrompt",
      label: t("profile.chatPrompt"),
      description: t("profile.chatPromptDesc"),
      placeholder: t("profile.chatPromptPlaceholder"),
      value: chatPrompt,
      onChange: setChatPrompt,
    },
    {
      id: "shoppingPrompt",
      label: t("profile.shoppingPrompt"),
      description: t("profile.shoppingPromptDesc"),
      placeholder: t("profile.shoppingPromptPlaceholder"),
      value: shoppingPrompt,
      onChange: setShoppingPrompt,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <section>
        <h2 className="text-2xl font-medium tracking-tight">{t("profile.groupPrompts")}</h2>
        <div className="mt-6 space-y-8">
          {promptFields.map((field) => (
            <div key={field.id}>
              <Label htmlFor={field.id} className="text-base">{field.label}</Label>
              <p id={`${field.id}-desc`} className="mt-1 mb-3 text-sm text-muted-foreground">{field.description}</p>
              <Textarea
                id={field.id}
                aria-describedby={`${field.id}-desc`}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                maxLength={500}
                className="resize-none"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 border-t border-border pt-10">
        <h2 className="text-2xl font-medium tracking-tight">{t("profile.groupOther")}</h2>
        <div className="mt-6 space-y-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="cookingSuppliesExpandedByDefault"
              ref={cookingSuppliesToggleRef}
              checked={cookingSuppliesExpandedByDefault}
              onCheckedChange={handleCookingSuppliesToggle}
              className="mt-[3px]"
            />
            <Label htmlFor="cookingSuppliesExpandedByDefault" className="cursor-pointer text-base">
              {t("profile.cookingSuppliesExpandedByDefault")}
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="dirkSecretModeEnabled"
              ref={dirkSecretToggleRef}
              checked={dirkSecretModeEnabled}
              onCheckedChange={handleDirkSecretToggle}
              className="mt-[3px]"
            />
            <Label htmlFor="dirkSecretModeEnabled" className="cursor-pointer text-base">
              {t("profile.dirkSecretModeEnabled")}
            </Label>
          </div>
        </div>

        {error && <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}

        <div className="mt-8 flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            {saved && (
              <>
                <Check className="size-4" />
                {t("profile.saved")}
              </>
            )}
          </span>
        </div>
      </section>

      <section className="mt-16 border-t border-border pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="text-2xl font-medium tracking-tight">{t("profile.apiToken")}</h2>
          <a
            href="/llms.txt"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
          >
            {t("profile.apiDocs")}
            <ExternalLink className="size-3.5" />
          </a>
        </div>
        <p className="mt-2 text-muted-foreground">{t("profile.apiTokenDesc")}</p>

        {rawApiToken ? (
          <div className="mt-6">
            <Label htmlFor="rawApiToken">{t("profile.apiTokenReady")}</Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input id="rawApiToken" readOnly value={rawApiToken} className="font-mono text-xs" />
              <Button type="button" variant="secondary" onClick={handleCopyApiToken} className="shrink-0">
                {apiTokenCopied ? <Check /> : <Copy />}
                {apiTokenCopied ? t("shopping.copied") : t("profile.copyToken")}
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t("profile.apiTokenOneTime")}</p>
          </div>
        ) : (
          <p className="mt-6">
            {apiTokenPreview ? t("profile.apiTokenActive") : t("profile.apiTokenEmpty")}
            {apiTokenPreview && <span className="mt-1 block font-mono text-xs text-muted-foreground">{apiTokenPreview}</span>}
          </p>
        )}

        {(apiTokenCreatedAt || apiTokenLastUsedAt) && (
          <dl className="mt-4 space-y-1 text-sm text-muted-foreground">
            {apiTokenCreatedAt && (
              <div className="flex gap-1.5">
                <dt>{t("profile.apiTokenCreated")}:</dt>
                <dd>{formatDateTime(apiTokenCreatedAt)}</dd>
              </div>
            )}
            {apiTokenLastUsedAt && (
              <div className="flex gap-1.5">
                <dt>{t("profile.apiTokenLastUsed")}:</dt>
                <dd>{formatDateTime(apiTokenLastUsedAt)}</dd>
              </div>
            )}
          </dl>
        )}

        {apiTokenError && <p role="alert" className="mt-4 text-sm text-destructive">{apiTokenError}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant={apiTokenPreview ? "outline" : "default"} onClick={handleGenerateApiToken} disabled={apiTokenBusy}>
            {apiTokenBusy ? t("common.loading") : apiTokenPreview ? t("profile.regenerateToken") : t("profile.generateToken")}
          </Button>
          {apiTokenPreview && (
            <Button type="button" variant="ghost" onClick={handleRevokeApiToken} disabled={apiTokenBusy}>
              <Trash2 />
              {t("profile.revokeToken")}
            </Button>
          )}
        </div>
      </section>
    </form>
  );
}
