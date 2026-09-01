import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { suppliers as suppliersTable } from "@/lib/db/schema";
import { toSupplier } from "@/lib/db/mappers";
import { SuppliersTable } from "./suppliers-table";

// Server Component — one-time fetch at request time, no client-side
// onSnapshot listener (see src/lib/db/README.md).
export default async function SuppliersPage() {
  const rows = await getDb().select().from(suppliersTable).orderBy(asc(suppliersTable.name));
  const suppliers = rows.map(toSupplier);

  return (
    <div className="flex flex-col gap-6">
      <SuppliersTable suppliers={suppliers} />
    </div>
  );
}
