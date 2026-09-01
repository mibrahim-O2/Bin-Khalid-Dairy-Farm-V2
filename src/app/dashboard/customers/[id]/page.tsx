import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { getDb } from "@/lib/db/client";
import {
  billLineItems,
  bills,
  customerLedgerTransactions,
  customerRates,
  customers,
  products,
} from "@/lib/db/schema";
import { toBill, toCustomer, toCustomerLedgerTransaction, toCustomerRate, toProduct } from "@/lib/db/mappers";
import { CustomerDetailClient } from "./customer-detail-client";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  const isOwner = session ? isOwnerSession(session) : false;

  const db = getDb();
  const [[customerRow], productRows, rateRows, billRows, [openingBalanceRow]] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, id)),
    db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
    db.select().from(customerRates).where(eq(customerRates.customerId, id)),
    db.select().from(bills).where(eq(bills.customerId, id)).orderBy(desc(bills.createdAt)),
    db
      .select()
      .from(customerLedgerTransactions)
      .where(
        and(
          eq(customerLedgerTransactions.customerId, id),
          eq(customerLedgerTransactions.type, "opening_balance")
        )
      )
      .limit(1),
  ]);

  const billIds = billRows.map((b) => b.id);
  const lineItemRows =
    billIds.length > 0
      ? await db.select().from(billLineItems).where(inArray(billLineItems.billId, billIds)).orderBy(asc(billLineItems.sortOrder))
      : [];
  const lineItemsByBillId = new Map<string, typeof lineItemRows>();
  for (const line of lineItemRows) {
    const existing = lineItemsByBillId.get(line.billId) ?? [];
    existing.push(line);
    lineItemsByBillId.set(line.billId, existing);
  }

  return (
    <CustomerDetailClient
      isOwner={isOwner}
      customer={customerRow ? toCustomer(customerRow) : null}
      products={productRows.map(toProduct)}
      rates={rateRows.map(toCustomerRate)}
      bills={billRows.map((row) => toBill(row, lineItemsByBillId.get(row.id) ?? []))}
      openingBalanceEntry={openingBalanceRow ? toCustomerLedgerTransaction(openingBalanceRow) : null}
    />
  );
}
