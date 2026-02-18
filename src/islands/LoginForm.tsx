import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

interface Props {
  redirect?: string;
  inviteRequired: boolean;
}

export default function LoginForm({ redirect, inviteRequired }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
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

        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });

        if (signUpError) {
          setError(signUpError.message || "Registration failed");
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message || "Login failed");
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

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader>
        <CardTitle>{isRegister ? "Register" : "Login"}</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
