import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { farmSupplyItems as farmSupplyItemsTable } from "@/lib/db/schema";
import { toFarmSupplyItem } from "@/lib/db/mappers";
import { Button } from "@/components/ui/button";
import { FarmSupplyItemFormDialog } from "./farm-supply-item-form-dialog";
import { FarmSuppliesTable } from "./farm-supplies-table";

// Server Component — one-time fetch at request time, no client-side
// onSnapshot listener (see src/lib/db/README.md).
export default async function FarmSuppliesPage() {
  const rows = await getDb()
    .select()
    .from(farmSupplyItemsTable)
    .orderBy(asc(farmSupplyItemsTable.name));
  const items = rows.map(toFarmSupplyItem);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Farm Supplies</h1>
          <p className="text-sm text-muted-foreground">Materials bought from suppliers.</p>
        </div>
        <FarmSupplyItemFormDialog trigger={<Button>Add item</Button>} />
      </div>
      <FarmSuppliesTable items={items} />
    </div>
  );
}
