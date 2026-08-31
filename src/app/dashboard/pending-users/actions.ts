"use server";

import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";

type ActionResult = { ok: true } | { ok: false; error: string };

const approveSchema = z.object({
  uid: z.string().min(1),
});

/**
 * Approves a pending sign-up: grants the `active` custom claim (the same
 * gate every dashboard route already checks) plus an explicit `admin` role
 * claim — never `owner`. Owner-ness is never a stored claim; it's always
 * re-derived from OWNER_UID/OWNER_EMAIL (see src/lib/auth/owner.ts).
 *
 * Never trust a client-side owner check alone — same principle as the other
 * financial Server Actions in this app — so this independently re-verifies
 * the caller is the Owner before doing anything.
 */
export async function approvePendingUser(input: { uid: string }): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can approve pending users." };
  }

  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { uid } = parsed.data;

  try {
    const auth = getAdminAuth();
    const userRecord = await auth.getUser(uid);

    await auth.setCustomUserClaims(uid, {
      ...userRecord.customClaims,
      active: true,
      role: "admin",
    });

    // Mirror onto /users/{uid} for reference — writes here go through this
    // Server Action only (Firestore rules deny direct client writes).
    await getAdminDb()
      .doc(`users/${uid}`)
      .set(
        {
          email: userRecord.email ?? null,
          displayName: userRecord.displayName ?? null,
          active: true,
          role: "admin",
          approvedAt: new Date().toISOString(),
          approvedBy: { uid: session.uid, email: session.email },
        },
        { merge: true }
      );

    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to approve this user." };
  }
}
