"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(getFirebaseAuth());
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      Sign out
    </Button>
  );
}
