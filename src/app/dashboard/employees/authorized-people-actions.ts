"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { authorizedPeople } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth/session";

type ActionResult = { ok: true } | { ok: false; error: string };

const personInputSchema = z.object({
  name: z.string().trim().min(1),
});

export async function createAuthorizedPerson(
  input: z.infer<typeof personInputSchema>
): Promise<ActionResult & { personId?: string }> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = personInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Name is required." };
  }
  const { name } = parsed.data;

  const id = randomUUID();
  try {
    await getDb()
      .insert(authorizedPeople)
      .values({ id, name, active: true });
    revalidatePath("/dashboard/employees");
    return { ok: true, personId: id };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const updatePersonSchema = personInputSchema.extend({
  personId: z.string().min(1),
});

export async function updateAuthorizedPerson(input: z.infer<typeof updatePersonSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = updatePersonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Name is required." };
  }
  const { personId, name } = parsed.data;

  try {
    await getDb()
      .update(authorizedPeople)
      .set({ name, updatedAt: new Date() })
      .where(eq(authorizedPeople.id, personId));
    revalidatePath("/dashboard/employees");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save. Check your connection and try again." };
  }
}

const setActiveSchema = z.object({
  personId: z.string().min(1),
  active: z.boolean(),
});

export async function setAuthorizedPersonActive(input: z.infer<typeof setActiveSchema>): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session || !session.active) {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { personId, active } = parsed.data;

  try {
    await getDb()
      .update(authorizedPeople)
      .set({ active, updatedAt: new Date() })
      .where(eq(authorizedPeople.id, personId));
    revalidatePath("/dashboard/employees");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update. Check your connection and try again." };
  }
}
