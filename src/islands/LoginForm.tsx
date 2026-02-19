import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

interface Props {
  redirect?: string;
  inviteRequired: boolean;
  authMode?: string;
}

export default function LoginForm({ redirect, inviteRequired, authMode }: Props) {
  const isSimple = authMode === "simple";
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function postAuth(path: string, payload: Record<string, string>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) return null;

    try {
      const body = await response.json();
      if (body?.message && typeof body.message === "string") {
        return body.message;
      }
    } catch {
      // Ignore parsing errors and use fallback below.
    }

    return t("auth.errorAuth");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSimple) {
        const err = await postAuth("/api/auth/simple-login", { name });
        if (err) {
          setError(err);
          setLoading(false);
          return;
        }
      } else if (isRegister) {
        // Validate invite code client-side first
        if (inviteRequired) {
          const res = await fetch("/api/auth/validate-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: inviteCode }),
          });
          if (!res.ok) {
            setError(t("auth.errorInvite"));
            setLoading(false);
            return;
          }
        }

        const signUpError = await postAuth("/api/auth/sign-up/email", {
          email,
          password,
          name: name || email.split("@")[0],
        });

        if (signUpError) {
          setError(signUpError || t("auth.errorRegister"));
          setLoading(false);
          return;
        }
      } else {
        const signInError = await postAuth("/api/auth/sign-in/email", {
          email,
          password,
        });

        if (signInError) {
          setError(signInError || t("auth.errorLogin"));
          setLoading(false);
          return;
        }
      }

      window.location.href = redirect || "/";
    } catch {
      setError(t("common.error"));
      setLoading(false);
    }
  }

  if (isSimple) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("auth.name")}</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={t("auth.namePlaceholder")}
            autoFocus
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : t("auth.letsGo")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isRegister && (
        <div className="space-y-2">
          <Label htmlFor="name">{t("auth.name")}</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.yourName")}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder={t("auth.emailPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder={t("auth.passwordPlaceholder")}
        />
      </div>

      {isRegister && inviteRequired && (
        <div className="space-y-2">
          <Label htmlFor="invite">{t("auth.inviteCode")}</Label>
          <Input
            id="invite"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
            placeholder={t("auth.invitePlaceholder")}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "..." : isRegister ? t("auth.registerButton") : t("auth.loginButton")}
      </Button>

      <p className="text-sm text-center text-muted-foreground">
        {isRegister ? t("auth.hasAccount") : t("auth.noAccount")}{" "}
        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setError("");
          }}
          className="text-primary hover:underline"
        >
          {isRegister ? t("auth.signInLink") : t("auth.registerLink")}
        </button>
      </p>
    </form>
  );
}
