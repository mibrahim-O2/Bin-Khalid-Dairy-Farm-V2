"use server";

// Non-financial master-data CRUD for employees — mirrors
// customers/crud-actions.ts and suppliers/crud-actions.ts exactly. The
// financial employee actions (opening balance, accruals, payments,
// ledger, statements) live in employees/actions.ts and
// employees/[id]/statements/actions.ts.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { employees } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";

type ActionResult = { ok: true } | { ok: false; error: string };

const employeeInputSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().max(50).optional(),
  whatsappNumber: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
});

export async function createEmployee(
  input: z.infer<typeof employeeInputSchema>
): Promise<ActionResult & { employeeId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = employeeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Name is required." };
  }
  const { name, phone, whatsappNumber, address } = parsed.data;

  const id = randomUUID();
  try {
    await getDb()
      .insert(employees)
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
    revalidatePath("/dashboard/employees");
    return { ok: true, employeeId: id };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const updateEmployeeSchema = employeeInputSchema.extend({
  employeeId: z.string().min(1),
});

export async function updateEmployee(input: z.infer<typeof updateEmployeeSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updateEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Name is required." };
  }
  const { employeeId, name, phone, whatsappNumber, address } = parsed.data;

  try {
    await getDb()
      .update(employees)
      .set({
        name,
        phone: phone || null,
        whatsappNumber: whatsappNumber || null,
        address: address || null,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, employeeId));
    revalidatePath("/dashboard/employees");
    revalidatePath(`/dashboard/employees/${employeeId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const setActiveSchema = z.object({
  employeeId: z.string().min(1),
  active: z.boolean(),
});

export async function setEmployeeActive(input: z.infer<typeof setActiveSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { employeeId, active } = parsed.data;

  try {
    await getDb()
      .update(employees)
      .set({ active, updatedAt: new Date() })
      .where(eq(employees.id, employeeId));
    revalidatePath("/dashboard/employees");
    revalidatePath(`/dashboard/employees/${employeeId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update. Check your connection and try again." };
  }
}
