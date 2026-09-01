"use server";

// Non-financial master-data CRUD for customers — client writes are no
// longer allowed at all (the two-tier Firestore trust model collapsed
// into one: every write, financial or not, goes through a Server Action
// now — see src/lib/db/README.md). The financial customer actions
// (opening balance, payments, ledger, delete) still live in
// src/app/dashboard/customers/actions.ts on Firestore until M4/M5.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/firebase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

const customerInputSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
});

export async function createCustomer(
  input: z.infer<typeof customerInputSchema>
): Promise<ActionResult & { customerId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Name is required." };
  }
  const { name, phone, address } = parsed.data;

  const id = randomUUID();
  const now = new Date();
  try {
    await getDb()
      .insert(customers)
      .values({
        id,
        name,
        phone: phone || null,
        address: address || null,
        active: true,
        balance: "0",
        hasOpeningBalance: false,
        createdByUid: session.uid,
      });

    // TRANSITIONAL — bills/payments/opening-balance (still Firestore-based
    // until M3-M5) read `customers/{id}` directly and throw "Customer not
    // found" if it's missing. Without this mirror, billing would be
    // functionally broken for every customer created after M2 shipped,
    // right up until those actions finish migrating. Removed once they do.
    try {
      await getAdminDb()
        .doc(`customers/${id}`)
        .set({
          name,
          phone: phone || null,
          address: address || null,
          active: true,
          balance: 0,
          hasOpeningBalance: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          createdBy: session.uid,
        });
    } catch (err) {
      console.error(`[transitional] Failed to mirror new customer ${id} to Firestore:`, err);
    }

    revalidatePath("/dashboard/customers");
    return { ok: true, customerId: id };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const updateCustomerSchema = customerInputSchema.extend({
  customerId: z.string().min(1),
});

export async function updateCustomer(input: z.infer<typeof updateCustomerSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Name is required." };
  }
  const { customerId, name, phone, address } = parsed.data;

  try {
    await getDb()
      .update(customers)
      .set({
        name,
        phone: phone || null,
        address: address || null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));

    // TRANSITIONAL — the still-Firestore-based bill editor and ledger page
    // (M3/M5) display this customer's name in their own header directly
    // off their own Firestore read; without this mirror a rename here
    // would show correctly everywhere migrated, but stay stale on those
    // two pages until they migrate. Balance/hasOpeningBalance are NOT
    // touched here — Firestore stays authoritative for those until M3-M5
    // (see the reverse-direction sync in customers/actions.ts and
    // bills/actions.ts), only mirroring what this action actually owns.
    try {
      await getAdminDb().doc(`customers/${customerId}`).set(
        {
          name,
          phone: phone || null,
          address: address || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error(`[transitional] Failed to mirror customer ${customerId} update to Firestore:`, err);
    }

    revalidatePath("/dashboard/customers");
    revalidatePath(`/dashboard/customers/${customerId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const setActiveSchema = z.object({
  customerId: z.string().min(1),
  active: z.boolean(),
});

export async function setCustomerActive(input: z.infer<typeof setActiveSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { customerId, active } = parsed.data;

  try {
    await getDb()
      .update(customers)
      .set({ active, updatedAt: new Date() })
      .where(eq(customers.id, customerId));

    // TRANSITIONAL — see updateCustomer's comment above. Nothing on the
    // Firestore side currently branches on `active`, so this is precautionary
    // consistency rather than a functional fix, but cheap to keep in sync.
    try {
      await getAdminDb()
        .doc(`customers/${customerId}`)
        .set({ active, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error(`[transitional] Failed to mirror customer ${customerId} active flag to Firestore:`, err);
    }

    revalidatePath("/dashboard/customers");
    revalidatePath(`/dashboard/customers/${customerId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update. Check your connection and try again." };
  }
}
