import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { products as productsTable } from "@/lib/db/schema";
import { toProduct } from "@/lib/db/mappers";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductsTable } from "./products-table";

// Server Component — one-time fetch at request time, no client-side
// onSnapshot listener. Mutations (add/edit/archive) go through Server
// Actions and call router.refresh() to re-run this fetch; there is no
// live cross-tab sync anymore, a deliberate trade-off for the Postgres
// migration (see src/lib/db/README.md).
export default async function ProductsPage() {
  const rows = await getDb().select().from(productsTable).orderBy(asc(productsTable.name));
  const products = rows.map(toProduct);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">
            Products and services sold to customers.
          </p>
        </div>
        <ProductFormDialog trigger={<Button>Add product</Button>} />
      </div>

      <ProductsTable products={products} />
    </div>
  );
}
