import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { supplierLedgerTransactions, supplierStatements, suppliers } from "@/lib/db/schema";
import { toSupplier, toSupplierLedgerTransaction, toSupplierStatement } from "@/lib/db/mappers";
import { SupplierDetailClient } from "./supplier-detail-client";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const session = await getServerSession();
  const isOwner = session ? isOwnerSession(session) : false;

  const [[supplierRow], [openingBalanceRow], statementRows] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.id, id)),
    db
      .select()
      .from(supplierLedgerTransactions)
      .where(
        and(
          eq(supplierLedgerTransactions.supplierId, id),
          eq(supplierLedgerTransactions.type, "opening_balance")
        )
      )
      .limit(1),
    db.select().from(supplierStatements).where(eq(supplierStatements.supplierId, id)).orderBy(desc(supplierStatements.createdAt)),
  ]);

  return (
    <SupplierDetailClient
      isOwner={isOwner}
      supplier={supplierRow ? toSupplier(supplierRow) : null}
      openingBalanceEntry={openingBalanceRow ? toSupplierLedgerTransaction(openingBalanceRow) : null}
      statements={statementRows.map(toSupplierStatement)}
    />
  );
}
