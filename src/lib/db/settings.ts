import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { settings } from "./schema";
import type { BusinessSettings, InvoiceSettings, PaymentSettings } from "@/types/settings";

// Phase 9 defaults — used until an admin saves real values from the
// Settings page. Previously hardcoded directly in the invoice/statement
// templates (src/lib/business-info.ts, Phase 8); now the fallback a fresh
// install starts from.
const DEFAULT_BUSINESS: BusinessSettings = {
  name: "Bin Khalid Dairy Farm",
  nameUrdu: "بن خالد ڈیری فارم",
  phone: null,
  address: null,
};

const DEFAULT_PAYMENTS: PaymentSettings = { accounts: [] };

const DEFAULT_INVOICES: InvoiceSettings = { footerNote: null, footerNoteUrdu: null };

/** Reads one `settings` row's jsonb `data`, falling back to a default when
 *  no row exists yet (a fresh install, or before that category's ever
 *  been saved) — never throws for a missing row. */
async function getSetting<T>(id: string, fallback: T): Promise<T> {
  const [row] = await getDb().select().from(settings).where(eq(settings.id, id));
  if (!row) return fallback;
  // jsonb round-trips as a plain object already — no numeric-string
  // conversion needed here, unlike the money columns elsewhere in this
  // schema.
  return { ...fallback, ...(row.data as Partial<T>) };
}

export function getBusinessSettings(): Promise<BusinessSettings> {
  return getSetting("business", DEFAULT_BUSINESS);
}

export function getPaymentSettings(): Promise<PaymentSettings> {
  return getSetting("payments", DEFAULT_PAYMENTS);
}

export function getInvoiceSettings(): Promise<InvoiceSettings> {
  return getSetting("invoices", DEFAULT_INVOICES);
}
