import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { billLineItems, bills, customerRates, customers, products } from "@/lib/db/schema";
import { toBill, toCustomer, toCustomerRate, toProduct } from "@/lib/db/mappers";
import { BillEditorClient } from "./bill-editor-client";

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string; billId: string }>;
}) {
  const { id: customerId, billId } = await params;
  const db = getDb();

  const [[billRow], [customerRow], productRows, rateRows] = await Promise.all([
    db.select().from(bills).where(eq(bills.id, billId)),
    db.select().from(customers).where(eq(customers.id, customerId)),
    db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
    db.select().from(customerRates).where(eq(customerRates.customerId, customerId)),
  ]);

  const lineItemRows = billRow
    ? await db
        .select()
        .from(billLineItems)
        .where(eq(billLineItems.billId, billId))
        .orderBy(asc(billLineItems.sortOrder))
    : [];

  return (
    <BillEditorClient
      customerId={customerId}
      bill={billRow ? toBill(billRow, lineItemRows) : null}
      customer={customerRow ? toCustomer(customerRow) : null}
      products={productRows.map(toProduct)}
      rates={rateRows.map(toCustomerRate)}
    />
  );
}
