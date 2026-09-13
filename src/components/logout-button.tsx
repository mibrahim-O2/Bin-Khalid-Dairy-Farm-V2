"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(getFirebaseAuth());
    router.push("/login");
    router.refresh();
  }

  if (iconOnly) {
    return (
      <Button variant="outline" size="icon" onClick={handleLogout} aria-label="Sign out" title="Sign out">
        <LogOut className="size-4" />
      </Button>
    );
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      Sign out
    </Button>
  );
}
