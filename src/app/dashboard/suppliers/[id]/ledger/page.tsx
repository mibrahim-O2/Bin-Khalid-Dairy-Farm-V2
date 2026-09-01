import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { supplierLedgerTransactions, suppliers } from "@/lib/db/schema";
import { toSupplier, toSupplierLedgerTransaction } from "@/lib/db/mappers";
import { LedgerViewClient } from "./ledger-view-client";

export default async function SupplierLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = await params;
  const db = getDb();

  const [[supplierRow], transactionRows] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.id, supplierId)),
    db
      .select()
      .from(supplierLedgerTransactions)
      .where(eq(supplierLedgerTransactions.supplierId, supplierId))
      .orderBy(asc(supplierLedgerTransactions.createdAt)),
  ]);

  return (
    <LedgerViewClient
      supplierId={supplierId}
      supplierName={supplierRow ? toSupplier(supplierRow).name : null}
      transactions={transactionRows.map(toSupplierLedgerTransaction)}
    />
  );
}
