"use server";

// Effective-dated salary history — append-only (see
// SYSTEM_ARCHITECTURE.md §5 rule 5: a later change must never alter what
// an already-finalized record snapshotted). No historize-then-overwrite
// step needed, unlike customer rates — every entry here is kept forever;
// getCurrentSalary() just picks the latest one in effect as of a date.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { employeeSalaryHistory } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";

type ActionResult = { ok: true } | { ok: false; error: string };

const setSalarySchema = z.object({
  employeeId: z.string().min(1),
  monthlySalary: z.number().positive(),
  effectiveFrom: z.string().min(1),
  note: z.string().max(500).optional(),
});

export async function setEmployeeSalary(input: z.infer<typeof setSalarySchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = setSalarySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid monthly salary and effective date." };
  }
  const { employeeId, monthlySalary, effectiveFrom, note } = parsed.data;

  try {
    await getDb().insert(employeeSalaryHistory).values({
      employeeId,
      monthlySalary: String(monthlySalary),
      effectiveFrom,
      note: note?.trim() || null,
      createdByUid: session.uid,
    });
    revalidatePath(`/dashboard/employees/${employeeId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}
