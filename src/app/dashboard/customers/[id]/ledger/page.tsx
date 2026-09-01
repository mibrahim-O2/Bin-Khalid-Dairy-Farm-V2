import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customerLedgerTransactions, customers } from "@/lib/db/schema";
import { toCustomer, toCustomerLedgerTransaction } from "@/lib/db/mappers";
import { LedgerViewClient } from "./ledger-view-client";

export default async function CustomerLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = await params;
  const db = getDb();

  const [[customerRow], transactionRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, customerId)),
    db
      .select()
      .from(customerLedgerTransactions)
      .where(eq(customerLedgerTransactions.customerId, customerId))
      .orderBy(asc(customerLedgerTransactions.createdAt)),
  ]);

  return (
    <LedgerViewClient
      customerId={customerId}
      customerName={customerRow ? toCustomer(customerRow).name : null}
      transactions={transactionRows.map(toCustomerLedgerTransaction)}
    />
  );
}
