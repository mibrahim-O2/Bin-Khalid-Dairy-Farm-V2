"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/firebase/admin";

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
  const now = new Date();
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

    // TRANSITIONAL — the still-Firestore-based bill editor (M3) queries
    // Firestore's `products` collection directly for its "add product"
    // picker. Without this mirror, a product created after M2 shipped
    // would be invisible there — usable everywhere migrated, but
    // impossible to actually bill a customer for — until bills migrate.
    try {
      await getAdminDb()
        .doc(`products/${id}`)
        .set({
          name,
          unit,
          billingType,
          defaultRate,
          active: true,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
    } catch (err) {
      console.error(`[transitional] Failed to mirror new product ${id} to Firestore:`, err);
    }

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

    // TRANSITIONAL — see createProduct's comment above.
    try {
      await getAdminDb().doc(`products/${productId}`).set(
        {
          name,
          unit,
          billingType,
          defaultRate,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error(`[transitional] Failed to mirror product ${productId} update to Firestore:`, err);
    }

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

    // TRANSITIONAL — the bill editor's product picker filters on
    // `active == true`, so this one actually matters functionally, not
    // just cosmetically: an product archived only in Postgres would keep
    // showing up as selectable there until this mirrors too.
    try {
      await getAdminDb()
        .doc(`products/${productId}`)
        .set({ active, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error(`[transitional] Failed to mirror product ${productId} active flag to Firestore:`, err);
    }

    revalidatePath("/dashboard/products");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update. Check your connection and try again." };
  }
}
