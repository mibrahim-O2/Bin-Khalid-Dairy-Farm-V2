"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { customerRateHistory, customerRates } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";

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

    revalidatePath(`/dashboard/customers/${customerId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}
