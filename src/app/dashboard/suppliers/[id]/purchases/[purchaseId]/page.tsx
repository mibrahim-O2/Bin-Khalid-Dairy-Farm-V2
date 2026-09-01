import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { farmSupplyItems, purchaseLineItems, purchases, suppliers } from "@/lib/db/schema";
import { toFarmSupplyItem, toPurchase, toSupplier } from "@/lib/db/mappers";
import { PurchaseEditorClient } from "./purchase-editor-client";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; purchaseId: string }>;
}) {
  const { id: supplierId, purchaseId } = await params;
  const db = getDb();

  const [[purchaseRow], [supplierRow], itemRows] = await Promise.all([
    db.select().from(purchases).where(eq(purchases.id, purchaseId)),
    db.select().from(suppliers).where(eq(suppliers.id, supplierId)),
    db.select().from(farmSupplyItems).where(eq(farmSupplyItems.active, true)).orderBy(asc(farmSupplyItems.name)),
  ]);

  const lineItemRows = purchaseRow
    ? await db
        .select()
        .from(purchaseLineItems)
        .where(eq(purchaseLineItems.purchaseId, purchaseId))
        .orderBy(asc(purchaseLineItems.sortOrder))
    : [];

  return (
    <PurchaseEditorClient
      supplierId={supplierId}
      purchase={purchaseRow ? toPurchase(purchaseRow, lineItemRows) : null}
      supplier={supplierRow ? toSupplier(supplierRow) : null}
      items={itemRows.map(toFarmSupplyItem)}
    />
  );
}
