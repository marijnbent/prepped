import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

    return "Authentication failed";
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
            setError("Invalid invite code");
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
          setError(signUpError || "Registration failed");
          setLoading(false);
          return;
        }
      } else {
        const signInError = await postAuth("/api/auth/sign-in/email", {
          email,
          password,
        });

        if (signInError) {
          setError(signInError || "Login failed");
          setLoading(false);
          return;
        }
      }

      window.location.href = redirect || "/";
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  if (isSimple) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your first name"
            autoFocus
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : "Let's go"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isRegister && (
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="Min. 8 characters"
        />
      </div>

      {isRegister && inviteRequired && (
        <div className="space-y-2">
          <Label htmlFor="invite">Invite Code</Label>
          <Input
            id="invite"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
            placeholder="Family invite code"
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "..." : isRegister ? "Create Account" : "Sign In"}
      </Button>

      <p className="text-sm text-center text-muted-foreground">
        {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setError("");
          }}
          className="text-primary hover:underline"
        >
          {isRegister ? "Sign in" : "Register"}
        </button>
      </p>
    </form>
  );
}
