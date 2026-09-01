"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";

type ActionResult = { ok: true } | { ok: false; error: string };

const productInputSchema = z.object({
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  billingType: z.enum(["milk", "simple"]),
  defaultRate: z.number().min(0),
});

export async function createProduct(
  input: z.infer<typeof productInputSchema>
): Promise<ActionResult & { productId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid name, unit, and non-negative rate." };
  }
  const { name, unit, billingType, defaultRate } = parsed.data;

  const id = randomUUID();
  try {
    await getDb()
      .insert(products)
      .values({
        id,
        name,
        unit,
        billingType,
        defaultRate: String(defaultRate),
        active: true,
      });
    revalidatePath("/dashboard/products");
    return { ok: true, productId: id };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const updateProductSchema = productInputSchema.extend({
  productId: z.string().min(1),
});

export async function updateProduct(input: z.infer<typeof updateProductSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid name, unit, and non-negative rate." };
  }
  const { productId, name, unit, billingType, defaultRate } = parsed.data;

  try {
    await getDb()
      .update(products)
      .set({
        name,
        unit,
        billingType,
        defaultRate: String(defaultRate),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));
    revalidatePath("/dashboard/products");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const setActiveSchema = z.object({
  productId: z.string().min(1),
  active: z.boolean(),
});

export async function setProductActive(input: z.infer<typeof setActiveSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { productId, active } = parsed.data;

  try {
    await getDb()
      .update(products)
      .set({ active, updatedAt: new Date() })
      .where(eq(products.id, productId));
    revalidatePath("/dashboard/products");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update. Check your connection and try again." };
  }
}
