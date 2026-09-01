import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  purchaseLineItems,
  purchases,
  supplierLedgerTransactions,
  supplierStatements,
  suppliers,
} from "@/lib/db/schema";
import { toPurchase, toSupplier, toSupplierLedgerTransaction, toSupplierStatement } from "@/lib/db/mappers";
import { SupplierDetailClient } from "./supplier-detail-client";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [[supplierRow], purchaseRows, [openingBalanceRow], statementRows] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.id, id)),
    db.select().from(purchases).where(eq(purchases.supplierId, id)).orderBy(desc(purchases.createdAt)),
    db
      .select()
      .from(supplierLedgerTransactions)
      .where(
        and(
          eq(supplierLedgerTransactions.supplierId, id),
          eq(supplierLedgerTransactions.type, "opening_balance")
        )
      )
      .limit(1),
    db.select().from(supplierStatements).where(eq(supplierStatements.supplierId, id)).orderBy(desc(supplierStatements.createdAt)),
  ]);

  const purchaseIds = purchaseRows.map((p) => p.id);
  const lineItemRows =
    purchaseIds.length > 0
      ? await db
          .select()
          .from(purchaseLineItems)
          .where(inArray(purchaseLineItems.purchaseId, purchaseIds))
          .orderBy(purchaseLineItems.sortOrder)
      : [];
  const lineItemsByPurchaseId = new Map<string, typeof lineItemRows>();
  for (const line of lineItemRows) {
    const existing = lineItemsByPurchaseId.get(line.purchaseId) ?? [];
    existing.push(line);
    lineItemsByPurchaseId.set(line.purchaseId, existing);
  }

  return (
    <SupplierDetailClient
      supplier={supplierRow ? toSupplier(supplierRow) : null}
      purchases={purchaseRows.map((row) => toPurchase(row, lineItemsByPurchaseId.get(row.id) ?? []))}
      openingBalanceEntry={openingBalanceRow ? toSupplierLedgerTransaction(openingBalanceRow) : null}
      statements={statementRows.map(toSupplierStatement)}
    />
  );
}
