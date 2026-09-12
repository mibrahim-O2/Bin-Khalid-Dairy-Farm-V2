import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { customerExtraMilk, customerMilkPauses, customers } from "@/lib/db/schema";
import { toCustomer, toCustomerExtraMilk, toCustomerMilkPause } from "@/lib/db/mappers";
import { MilkRecordTable } from "./milk-record-table";

// Server Component — one-time fetch at request time, matching every other
// list page in the app.
export default async function MilkRecordPage() {
  const db = getDb();
  const session = await getServerSession();
  const isOwner = session ? isOwnerSession(session) : false;

  const [customerRows, pauseRows, extraMilkRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.active, true)).orderBy(asc(customers.name)),
    db.select().from(customerMilkPauses).orderBy(desc(customerMilkPauses.pauseDate)),
    db.select().from(customerExtraMilk).orderBy(desc(customerExtraMilk.date)),
  ]);

  const customersList = customerRows.map(toCustomer);
  const pauses = pauseRows.map(toCustomerMilkPause);
  const extraMilk = extraMilkRows.map(toCustomerExtraMilk);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Milk Record</h1>
        <p className="text-sm text-muted-foreground">
          Track customer milk pauses, resumes, and extra milk over time — for reference only,
          this never affects billing, ledgers, or balances.
        </p>
      </div>
      <MilkRecordTable customers={customersList} pauses={pauses} extraMilk={extraMilk} isOwner={isOwner} />
    </div>
  );
}
