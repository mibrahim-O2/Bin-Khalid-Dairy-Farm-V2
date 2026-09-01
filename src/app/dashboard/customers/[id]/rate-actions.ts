"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { customerRateHistory, customerRates } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/firebase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

const setRateSchema = z.object({
  customerId: z.string().min(1),
  productId: z.string().min(1),
  rate: z.number().min(0),
});

/**
 * Sets a customer's rate for a product — mirrors the Firestore version's
 * runTransaction exactly: moves the outgoing rate into history before
 * overwriting it, inside one atomic transaction. A later rate change must
 * never alter what an already-finalized bill snapshotted
 * (SYSTEM_ARCHITECTURE.md §5 rule 5) — the bill itself snapshots the rate
 * at finalize time, so history here is purely an audit trail, not
 * something bills read back from.
 */
export async function setCustomerRate(input: z.infer<typeof setRateSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = setRateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid non-negative rate." };
  }
  const { customerId, productId, rate } = parsed.data;

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(customerRates)
        .where(and(eq(customerRates.customerId, customerId), eq(customerRates.productId, productId)));

      const now = new Date();

      if (existing) {
        await tx.insert(customerRateHistory).values({
          customerRateId: existing.id,
          rate: existing.rate,
          supersededAt: now,
          updatedByUid: existing.updatedByUid,
        });
        await tx
          .update(customerRates)
          .set({ rate: String(rate), updatedAt: now, updatedByUid: session.uid })
          .where(eq(customerRates.id, existing.id));
      } else {
        await tx.insert(customerRates).values({
          customerId,
          productId,
          rate: String(rate),
          updatedAt: now,
          updatedByUid: session.uid,
        });
      }
    });

    // TRANSITIONAL — the still-Firestore-based bill editor (M3) reads a
    // customer's rate straight from Firestore's `customerRates` collection
    // when adding a line item, falling back to the product's default rate
    // if nothing's there. Without this mirror, a rate set (or changed)
    // after M2 shipped would silently not apply to new bills until bills
    // migrate — the bill would just use the default rate instead, wrong
    // but with no visible error. Same doc-id convention the Firestore-only
    // version used (`${customerId}_${productId}`), so this doesn't
    // introduce a duplicate under a different id if a bill editor session
    // reads it later.
    try {
      await getAdminDb()
        .doc(`customerRates/${customerId}_${productId}`)
        .set({
          customerId,
          productId,
          rate,
          updatedAt: new Date().toISOString(),
          updatedBy: session.uid,
        });
    } catch (err) {
      console.error(`[transitional] Failed to mirror rate for ${customerId}/${productId} to Firestore:`, err);
    }

    revalidatePath(`/dashboard/customers/${customerId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}
