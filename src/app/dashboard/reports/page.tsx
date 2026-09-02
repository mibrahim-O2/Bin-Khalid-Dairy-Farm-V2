import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customers, employees, suppliers } from "@/lib/db/schema";
import { toCustomer, toEmployee, toSupplier } from "@/lib/db/mappers";
import { ReportsView } from "./reports-view";

// Server Component — one-time fetch at request time, matching every other
// list page in the app (see src/lib/db/README.md).
export default async function ReportsPage() {
  const db = getDb();
  const [customerRows, supplierRows, employeeRows] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.name)),
    db.select().from(suppliers).orderBy(asc(suppliers.name)),
    db.select().from(employees).orderBy(asc(employees.name)),
  ]);

  return (
    <ReportsView
      customers={customerRows.map(toCustomer)}
      suppliers={supplierRows.map(toSupplier)}
      employees={employeeRows.map(toEmployee)}
    />
  );
}
