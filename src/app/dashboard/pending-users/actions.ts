"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { logActivity } from "@/lib/db/activity-log";

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
  if (!session || !session.active) {
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

    // Mirror onto the Postgres `users` table for reference — never read for
    // authorization (that's always the session cookie's custom claims,
    // above); writes here go through this Server Action only (every table
    // denies direct client access at the RLS level regardless).
    const now = new Date();
    await getDb()
      .insert(users)
      .values({
        uid,
        email: userRecord.email ?? null,
        displayName: userRecord.displayName ?? null,
        active: true,
        role: "admin",
        approvedAt: now,
        approvedByUid: session.uid,
        approvedByEmail: session.email,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: userRecord.email ?? null,
          displayName: userRecord.displayName ?? null,
          active: true,
          role: "admin",
          approvedAt: now,
          approvedByUid: session.uid,
          approvedByEmail: session.email,
        },
      });

    await logActivity({
      action: "user_approved",
      targetType: "user",
      targetId: uid,
      actorUid: session.uid,
      actorEmail: session.email,
      details: { approvedEmail: userRecord.email ?? null },
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to approve this user." };
  }
}

const rejectSchema = z.object({
  uid: z.string().min(1),
});

/**
 * Rejects a pending sign-up by deleting the Firebase Auth account
 * outright — a pending user has never been approved, so there's nothing
 * else of theirs to clean up (no customers/bills/etc. reference a uid
 * that was never granted `active`). Same Owner-only gating as approve.
 */
export async function rejectPendingUser(input: { uid: string }): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false, error: "Only the account owner can reject pending users." };
  }

  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { uid } = parsed.data;

  try {
    const auth = getAdminAuth();
    const userRecord = await auth.getUser(uid);

    if (userRecord.customClaims?.active === true) {
      return { ok: false, error: "This account is already active — it can't be rejected." };
    }

    await auth.deleteUser(uid);

    // Defensive — a pending user is never mirrored into Postgres by
    // approvePendingUser (that only happens on approval), but delete any
    // row anyway in case one somehow exists.
    await getDb().delete(users).where(eq(users.uid, uid));

    await logActivity({
      action: "user_rejected",
      targetType: "user",
      targetId: uid,
      actorUid: session.uid,
      actorEmail: session.email,
      details: { rejectedEmail: userRecord.email ?? null },
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to reject this user." };
  }
}
