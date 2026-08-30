"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "./password-input";
import { establishSession } from "./auth-helpers";

export function SignUpForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      await updateProfile(credential.user, { displayName: fullName.trim() });
      await establishSession(credential);
      setInfo("Account created — waiting for admin approval.");
      router.push("/pending-approval");
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (code === "auth/weak-password") {
        setError("Password is too weak — use at least 6 characters.");
      } else {
        setError("Failed to create account. Check your details and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-name">Full name</Label>
        <Input
          id="signup-name"
          autoComplete="name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-password">Password</Label>
        <PasswordInput
          id="signup-password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-confirm-password">Confirm password</Label>
        <PasswordInput
          id="signup-confirm-password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? <p className="text-sm text-success">{info}</p> : null}

      <Button type="submit" disabled={loading} className="w-full">
        Create account
      </Button>
    </form>
  );
}
