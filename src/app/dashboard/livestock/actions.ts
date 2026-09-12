"use server";

// Livestock / Farm Animals module — purely for the farm's own reference,
// deliberately never touched by billing/ledger/balance logic. Permission
// model is intentionally different from every other module in this app:
// any active admin can ADD an animal record (and manage the admin-editable
// category list, same as Farm Supply Items/Products), but only the Owner
// can EDIT, DELETE, or change an existing animal record's status —
// including recording a sale or death.

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { getDb } from "@/lib/db/client";
import { animalCategories, animals } from "@/lib/db/schema";
import { isoDateSchema } from "@/lib/zod-date";

type ActionResult = { ok: true } | { ok: false; error: string };

const topLevelGroupSchema = z.enum(["buffalo", "cow", "calf", "other"]);

// ---------------------------------------------------------------------
// Animal categories — admin-managed reference list, same trust level as
// Farm Supply Items/Products (any active admin), not Owner-gated: adding
// "Goat" to the list isn't a destructive action on an existing record.
// ---------------------------------------------------------------------

const categoryInputSchema = z.object({
  name: z.string().trim().min(1),
  topLevelGroup: topLevelGroupSchema,
});

export async function createAnimalCategory(
  input: z.infer<typeof categoryInputSchema>
): Promise<ActionResult & { categoryId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid name and group." };
  }

  try {
    const [row] = await getDb()
      .insert(animalCategories)
      .values({ name: parsed.data.name, topLevelGroup: parsed.data.topLevelGroup })
      .returning({ id: animalCategories.id });
    revalidatePath("/dashboard/livestock");
    return { ok: true, categoryId: row.id };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const updateCategorySchema = categoryInputSchema.extend({
  categoryId: z.string().min(1),
});

export async function updateAnimalCategory(input: z.infer<typeof updateCategorySchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid name and group." };
  }
  const { categoryId, name, topLevelGroup } = parsed.data;

  try {
    await getDb()
      .update(animalCategories)
      .set({ name, topLevelGroup })
      .where(eq(animalCategories.id, categoryId));
    revalidatePath("/dashboard/livestock");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const setCategoryActiveSchema = z.object({
  categoryId: z.string().min(1),
  active: z.boolean(),
});

export async function setAnimalCategoryActive(input: z.infer<typeof setCategoryActiveSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = setCategoryActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  try {
    await getDb()
      .update(animalCategories)
      .set({ active: parsed.data.active })
      .where(eq(animalCategories.id, parsed.data.categoryId));
    revalidatePath("/dashboard/livestock");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update. Check your connection and try again." };
  }
}

const deleteCategorySchema = z.object({ categoryId: z.string().min(1) });

/**
 * Non-financial master data — any active admin can delete. Safe by
 * construction: animals reference a category with the default
 * (non-cascading) FK behavior, so Postgres rejects deleting one that's
 * actually assigned to an animal — this only ever succeeds for a category
 * nothing uses yet.
 */
export async function deleteAnimalCategory(input: z.infer<typeof deleteCategorySchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = deleteCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  try {
    await getDb().delete(animalCategories).where(eq(animalCategories.id, parsed.data.categoryId));
    revalidatePath("/dashboard/livestock");
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23503") {
      return { ok: false, error: "This category has animals recorded against it and can't be deleted — archive it instead." };
    }
    return { ok: false, error: "Failed to delete. Check your connection and try again." };
  }
}

// ---------------------------------------------------------------------
// Animal records — add is any active admin; every other change is
// Owner-only (see module doc comment above).
// ---------------------------------------------------------------------

const createAnimalSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().max(200).optional(),
  gender: z.enum(["male", "female"]),
  acquisitionDate: isoDateSchema,
  note: z.string().trim().max(1000).optional(),
});

export async function createAnimal(
  input: z.infer<typeof createAnimalSchema>
): Promise<ActionResult & { animalId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = createAnimalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid category, gender, and acquisition date." };
  }
  const { categoryId, name, gender, acquisitionDate, note } = parsed.data;

  try {
    const [row] = await getDb()
      .insert(animals)
      .values({
        categoryId,
        name: name || null,
        gender,
        acquisitionDate,
        note: note || null,
        createdByUid: session.uid,
      })
      .returning({ id: animals.id });
    revalidatePath("/dashboard/livestock");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { ok: true, animalId: row.id };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

function requireOwner(session: { uid: string; email: string | null } | null, active: boolean | undefined) {
  if (!session || !active) {
    return { ok: false as const, error: "Not authorized." };
  }
  if (!isOwnerSession(session)) {
    return { ok: false as const, error: "Only the account owner can change an animal record." };
  }
  return null;
}

const updateAnimalDetailsSchema = z.object({
  animalId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().trim().max(200).optional(),
  gender: z.enum(["male", "female"]),
  acquisitionDate: isoDateSchema,
  note: z.string().trim().max(1000).optional(),
});

/** Owner-only — core details, independent of status/sale/death fields. */
export async function updateAnimalDetails(input: z.infer<typeof updateAnimalDetailsSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  const denied = requireOwner(session, session?.active);
  if (denied) return denied;

  const parsed = updateAnimalDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid category, gender, and acquisition date." };
  }
  const { animalId, categoryId, name, gender, acquisitionDate, note } = parsed.data;

  try {
    await getDb()
      .update(animals)
      .set({
        categoryId,
        name: name || null,
        gender,
        acquisitionDate,
        note: note || null,
        updatedAt: new Date(),
        updatedByUid: session!.uid,
      })
      .where(eq(animals.id, animalId));
    revalidatePath("/dashboard/livestock");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const recordSaleSchema = z.object({
  animalId: z.string().min(1),
  saleDate: isoDateSchema,
  salePrice: z.number().min(0),
});

/** Owner-only. */
export async function recordAnimalSale(input: z.infer<typeof recordSaleSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  const denied = requireOwner(session, session?.active);
  if (denied) return denied;

  const parsed = recordSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid sale date and non-negative price." };
  }
  const { animalId, saleDate, salePrice } = parsed.data;

  try {
    await getDb()
      .update(animals)
      .set({
        status: "sold",
        saleDate,
        salePrice: String(salePrice),
        updatedAt: new Date(),
        updatedByUid: session!.uid,
      })
      .where(eq(animals.id, animalId));
    revalidatePath("/dashboard/livestock");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const recordDeathSchema = z.object({
  animalId: z.string().min(1),
  deceasedDate: isoDateSchema,
  deceasedNote: z.string().trim().max(1000).optional(),
});

/** Owner-only. */
export async function recordAnimalDeath(input: z.infer<typeof recordDeathSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  const denied = requireOwner(session, session?.active);
  if (denied) return denied;

  const parsed = recordDeathSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid date." };
  }
  const { animalId, deceasedDate, deceasedNote } = parsed.data;

  try {
    await getDb()
      .update(animals)
      .set({
        status: "deceased",
        deceasedDate,
        deceasedNote: deceasedNote || null,
        updatedAt: new Date(),
        updatedByUid: session!.uid,
      })
      .where(eq(animals.id, animalId));
    revalidatePath("/dashboard/livestock");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const reactivateSchema = z.object({ animalId: z.string().min(1) });

/** Owner-only — corrects a mistaken sale/death entry back to Active. */
export async function reactivateAnimal(input: z.infer<typeof reactivateSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  const denied = requireOwner(session, session?.active);
  if (denied) return denied;

  const parsed = reactivateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  try {
    await getDb()
      .update(animals)
      .set({
        status: "active",
        saleDate: null,
        salePrice: null,
        deceasedDate: null,
        deceasedNote: null,
        updatedAt: new Date(),
        updatedByUid: session!.uid,
      })
      .where(eq(animals.id, parsed.data.animalId));
    revalidatePath("/dashboard/livestock");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const deleteAnimalSchema = z.object({ animalId: z.string().min(1) });

/** Owner-only — permanent, no cascade concerns (nothing references an animal). */
export async function deleteAnimal(input: z.infer<typeof deleteAnimalSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  const denied = requireOwner(session, session?.active);
  if (denied) return denied;

  const parsed = deleteAnimalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  try {
    await getDb().delete(animals).where(eq(animals.id, parsed.data.animalId));
    revalidatePath("/dashboard/livestock");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to delete. Check your connection and try again." };
  }
}
