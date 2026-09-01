import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { purchaseLineItems, purchases, suppliers } from "@/lib/db/schema";
import { toPurchase, toSupplier } from "@/lib/db/mappers";
import { SupplierDetailClient } from "./supplier-detail-client";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [[supplierRow], purchaseRows] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.id, id)),
    db.select().from(purchases).where(eq(purchases.supplierId, id)).orderBy(desc(purchases.createdAt)),
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
    />
  );
}
