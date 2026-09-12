"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { farmSupplyItems } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";

type ActionResult = { ok: true } | { ok: false; error: string };

const itemInputSchema = z.object({
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  defaultRate: z.number().min(0),
});

export async function createFarmSupplyItem(
  input: z.infer<typeof itemInputSchema>
): Promise<ActionResult & { itemId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = itemInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid name, unit, and non-negative rate." };
  }
  const { name, unit, defaultRate } = parsed.data;

  const id = randomUUID();
  try {
    await getDb()
      .insert(farmSupplyItems)
      .values({
        id,
        name,
        unit,
        defaultRate: String(defaultRate),
        active: true,
      });
    revalidatePath("/dashboard/farm-supplies");
    return { ok: true, itemId: id };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const updateItemSchema = itemInputSchema.extend({
  itemId: z.string().min(1),
});

export async function updateFarmSupplyItem(input: z.infer<typeof updateItemSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid name, unit, and non-negative rate." };
  }
  const { itemId, name, unit, defaultRate } = parsed.data;

  try {
    await getDb()
      .update(farmSupplyItems)
      .set({
        name,
        unit,
        defaultRate: String(defaultRate),
        updatedAt: new Date(),
      })
      .where(eq(farmSupplyItems.id, itemId));
    revalidatePath("/dashboard/farm-supplies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const deleteItemSchema = z.object({
  itemId: z.string().min(1),
});

/**
 * Non-financial master data — any active admin can delete. Safe by
 * construction: purchase line items reference an item with the default
 * (non-cascading) FK behavior, so Postgres rejects deleting one that's
 * actually been used in a purchase — this only ever succeeds for an item
 * that was never purchased.
 */
export async function deleteFarmSupplyItem(input: z.infer<typeof deleteItemSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = deleteItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  try {
    await getDb().delete(farmSupplyItems).where(eq(farmSupplyItems.id, parsed.data.itemId));
    revalidatePath("/dashboard/farm-supplies");
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23503") {
      return { ok: false, error: "This item has already been used in a purchase and can't be deleted — archive it instead." };
    }
    return { ok: false, error: "Failed to delete. Check your connection and try again." };
  }
}

const setActiveSchema = z.object({
  itemId: z.string().min(1),
  active: z.boolean(),
});

export async function setFarmSupplyItemActive(input: z.infer<typeof setActiveSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { itemId, active } = parsed.data;

  try {
    await getDb()
      .update(farmSupplyItems)
      .set({ active, updatedAt: new Date() })
      .where(eq(farmSupplyItems.id, itemId));
    revalidatePath("/dashboard/farm-supplies");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update. Check your connection and try again." };
  }
}
