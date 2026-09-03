import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bills, billLineItems, customerMilkPauses, customers } from "@/lib/db/schema";
import { toCustomer, toCustomerMilkPause } from "@/lib/db/mappers";
import { toNumber } from "@/lib/money";
import { MilkRecordTable } from "./milk-record-table";

// Server Component — one-time fetch at request time, matching every other
// list page in the app.
export default async function MilkRecordPage() {
  const db = getDb();

  const [customerRows, pauseRows, dailyQtyRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.active, true)).orderBy(asc(customers.name)),
    db.select().from(customerMilkPauses).orderBy(desc(customerMilkPauses.pauseDate)),
    // Current daily milk quantity per customer — the most recent finalized
    // milk bill line item's dailyQty, one row per customer. This is the
    // LIVE value shown in the table's "Daily Milk Quantity" column; each
    // pause record separately keeps its own snapshot of this value taken
    // when the pause was recorded (see actions.ts), so a later change here
    // never rewrites a past pause's Milk Missed figure.
    db
      .selectDistinctOn([bills.customerId], {
        customerId: bills.customerId,
        dailyQty: billLineItems.dailyQty,
      })
      .from(billLineItems)
      .innerJoin(bills, eq(bills.id, billLineItems.billId))
      .where(eq(bills.status, "finalized"))
      .orderBy(bills.customerId, desc(bills.endDate), desc(bills.createdAt)),
  ]);

  const customersList = customerRows.map(toCustomer);
  const pauses = pauseRows.map(toCustomerMilkPause);
  const dailyQtyByCustomerId = new Map(
    dailyQtyRows
      .filter((r) => r.dailyQty !== null)
      .map((r) => [r.customerId, toNumber(r.dailyQty!)])
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Milk Record</h1>
        <p className="text-sm text-muted-foreground">
          Track customer milk pauses and resumes over time — for reference only, this
          never affects billing, ledgers, or balances.
        </p>
      </div>
      <MilkRecordTable customers={customersList} pauses={pauses} dailyQtyByCustomerId={Object.fromEntries(dailyQtyByCustomerId)} />
    </div>
  );
}
