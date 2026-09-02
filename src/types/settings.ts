/**
 * Shapes stored in the Postgres `settings` table's jsonb `data` column,
 * keyed by id ("business" | "payments" | "invoices") — see
 * src/lib/db/schema/core.ts. Free-form by column type, but each id has a
 * fixed shape in practice, defined here.
 */

export type BusinessSettings = {
  name: string;
  nameUrdu: string;
  phone: string | null;
  address: string | null;
};

/** One bank/JazzCash/EasyPaisa account to show on invoices/statements. */
export type PaymentAccount = {
  id: string;
  label: string;
  accountNumber: string;
};

export type PaymentSettings = {
  accounts: PaymentAccount[];
};

export type InvoiceSettings = {
  /** Shown in place of the default "Thank you for your business" footer line. */
  footerNote: string | null;
  footerNoteUrdu: string | null;
};
