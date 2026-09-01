import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customers as customersTable } from "@/lib/db/schema";
import { toCustomer } from "@/lib/db/mappers";
import { CustomersTable } from "./customers-table";

// Server Component — one-time fetch at request time, no client-side
// onSnapshot listener (see src/lib/db/README.md).
export default async function CustomersPage() {
  const rows = await getDb().select().from(customersTable).orderBy(asc(customersTable.name));
  const customers = rows.map(toCustomer);

  return (
    <div className="flex flex-col gap-6">
      <CustomersTable customers={customers} />
    </div>
  );
}
