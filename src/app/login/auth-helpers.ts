import type { UserCredential } from "firebase/auth";

export async function establishSession(credential: UserCredential) {
  const idToken = await credential.user.getIdToken();
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw new Error("Failed to establish session");
  }
}
