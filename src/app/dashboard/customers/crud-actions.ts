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

type ActionResult = { ok: true } | { ok: false; error: string };

const customerInputSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().max(50).optional(),
  whatsappNumber: z.string().trim().max(50).optional(),
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
  const { name, phone, whatsappNumber, address } = parsed.data;

  const id = randomUUID();
  try {
    await getDb()
      .insert(customers)
      .values({
        id,
        name,
        phone: phone || null,
        whatsappNumber: whatsappNumber || null,
        address: address || null,
        // Set once, here, at creation — never edited afterward (see the
        // Milk Record module). Today's date in the server's local
        // calendar day, not a timestamp.
        joiningDate: new Date().toISOString().slice(0, 10),
        active: true,
        balance: "0",
        hasOpeningBalance: false,
        createdByUid: session.uid,
      });
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
  const { customerId, name, phone, whatsappNumber, address } = parsed.data;

  try {
    await getDb()
      .update(customers)
      .set({
        name,
        phone: phone || null,
        whatsappNumber: whatsappNumber || null,
        address: address || null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));
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
    revalidatePath("/dashboard/customers");
    revalidatePath(`/dashboard/customers/${customerId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update. Check your connection and try again." };
  }
}
