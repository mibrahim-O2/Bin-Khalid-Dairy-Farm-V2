import { asc, eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { getDb } from "@/lib/db/client";
import { customerRates, customers, products } from "@/lib/db/schema";
import { toCustomer, toCustomerRate, toProduct } from "@/lib/db/mappers";
import { CustomerDetailClient } from "./customer-detail-client";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  const isOwner = session ? isOwnerSession(session) : false;

  const db = getDb();
  const [[customerRow], productRows, rateRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, id)),
    db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
    db.select().from(customerRates).where(eq(customerRates.customerId, id)),
  ]);

  return (
    <CustomerDetailClient
      isOwner={isOwner}
      customer={customerRow ? toCustomer(customerRow) : null}
      products={productRows.map(toProduct)}
      rates={rateRows.map(toCustomerRate)}
    />
  );
}
