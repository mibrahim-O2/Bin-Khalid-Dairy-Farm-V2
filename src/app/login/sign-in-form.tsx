"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "./password-input";
import { establishSession } from "./auth-helpers";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      await establishSession(credential);
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      await establishSession(credential);
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-4" onSubmit={handleEmailLogin}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          Sign in
        </Button>
      </form>
      <div className="relative text-center text-xs text-muted-foreground">
        <span className="bg-card px-2">or</span>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={loading}
        onClick={handleGoogleLogin}
        className="w-full"
      >
        Continue with Google
      </Button>
    </div>
  );
}
