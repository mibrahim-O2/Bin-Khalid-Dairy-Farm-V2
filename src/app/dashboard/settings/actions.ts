"use server";

// Settings module (Phase 9) — business info, payment accounts, invoice
// notices. Non-financial master data (same trust level as
// products/farm-supply-items): any active admin can edit, not Owner-only.
// Stored as jsonb rows in the `settings` table keyed by id — see
// src/lib/db/schema/core.ts and src/lib/db/settings.ts for the read side.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";

type ActionResult = { ok: true } | { ok: false; error: string };

async function upsertSetting(id: string, data: unknown, uid: string): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ id, data: data as object, updatedByUid: uid })
    .onConflictDoUpdate({
      target: settings.id,
      set: { data: data as object, updatedAt: new Date(), updatedByUid: uid },
    });
}

const businessSchema = z.object({
  name: z.string().trim().min(1),
  nameUrdu: z.string().trim().min(1),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
});

export async function updateBusinessSettings(input: z.infer<typeof businessSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid business name (English and Urdu)." };
  }
  const { name, nameUrdu, phone, address } = parsed.data;

  try {
    await upsertSetting(
      "business",
      { name, nameUrdu, phone: phone || null, address: address || null },
      session.uid
    );
    revalidatePath("/dashboard/settings");
    // The landing page reads business name/phone/address too (WhatsApp CTA,
    // contact line) and is statically generated for speed — bust that cache
    // so an edit here shows up on the next visit instead of waiting for a
    // redeploy.
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const paymentAccountSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1),
  accountNumber: z.string().trim().min(1),
});

const paymentsSchema = z.object({
  accounts: z.array(paymentAccountSchema),
});

export async function updatePaymentSettings(input: z.infer<typeof paymentsSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = paymentsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Every payment account needs a label and account number." };
  }

  try {
    await upsertSetting("payments", parsed.data, session.uid);
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const invoiceSchema = z.object({
  footerNote: z.string().trim().max(500).optional(),
  footerNoteUrdu: z.string().trim().max(500).optional(),
});

export async function updateInvoiceSettings(input: z.infer<typeof invoiceSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { footerNote, footerNoteUrdu } = parsed.data;

  try {
    await upsertSetting(
      "invoices",
      { footerNote: footerNote || null, footerNoteUrdu: footerNoteUrdu || null },
      session.uid
    );
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}
