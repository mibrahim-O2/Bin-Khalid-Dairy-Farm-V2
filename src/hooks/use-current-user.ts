"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

/**
 * The server session cookie (see src/lib/auth/session.ts) is what gates
 * routes, but direct client Firestore writes are authorized by the Firebase
 * client SDK's own signed-in user — which rehydrates asynchronously on page
 * load. Reading `getFirebaseAuth().currentUser` immediately on mount can
 * race and return null even though the user is authenticated. This hook
 * waits for that rehydration instead.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
