"use server";

// Non-financial master-data CRUD for suppliers — mirrors
// customers/crud-actions.ts exactly. The financial supplier actions
// (opening balance, payments, ledger, statements) still live in
// src/app/dashboard/suppliers/actions.ts on Firestore until M8/M9.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { suppliers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";

type ActionResult = { ok: true } | { ok: false; error: string };

const supplierInputSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().max(50).optional(),
  whatsappNumber: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
});

export async function createSupplier(
  input: z.infer<typeof supplierInputSchema>
): Promise<ActionResult & { supplierId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = supplierInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Name is required." };
  }
  const { name, phone, whatsappNumber, address } = parsed.data;

  const id = randomUUID();
  try {
    await getDb()
      .insert(suppliers)
      .values({
        id,
        name,
        phone: phone || null,
        whatsappNumber: whatsappNumber || null,
        address: address || null,
        active: true,
        balance: "0",
        hasOpeningBalance: false,
        createdByUid: session.uid,
      });
    revalidatePath("/dashboard/suppliers");
    return { ok: true, supplierId: id };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const updateSupplierSchema = supplierInputSchema.extend({
  supplierId: z.string().min(1),
});

export async function updateSupplier(input: z.infer<typeof updateSupplierSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Name is required." };
  }
  const { supplierId, name, phone, whatsappNumber, address } = parsed.data;

  try {
    await getDb()
      .update(suppliers)
      .set({
        name,
        phone: phone || null,
        whatsappNumber: whatsappNumber || null,
        address: address || null,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplierId));
    revalidatePath("/dashboard/suppliers");
    revalidatePath(`/dashboard/suppliers/${supplierId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const setActiveSchema = z.object({
  supplierId: z.string().min(1),
  active: z.boolean(),
});

export async function setSupplierActive(input: z.infer<typeof setActiveSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { supplierId, active } = parsed.data;

  try {
    await getDb()
      .update(suppliers)
      .set({ active, updatedAt: new Date() })
      .where(eq(suppliers.id, supplierId));
    revalidatePath("/dashboard/suppliers");
    revalidatePath(`/dashboard/suppliers/${supplierId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update. Check your connection and try again." };
  }
}
