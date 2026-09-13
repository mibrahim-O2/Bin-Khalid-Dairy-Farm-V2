import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { purchaseLineItems, purchases, supplierLedgerTransactions, supplierPayments, suppliers } from "@/lib/db/schema";
import { toPurchase, toSupplier, toSupplierLedgerTransaction } from "@/lib/db/mappers";
import { getBusinessSettings, getInvoiceSettings } from "@/lib/db/settings";
import type { Purchase } from "@/types/purchase";
import type { SupplierLedgerTransaction } from "@/types/supplier";
import { LedgerViewClient, type LedgerMonthGroup } from "./ledger-view-client";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function SupplierLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = await params;
  const db = getDb();
  const session = await getServerSession();
  const isOwner = session ? isOwnerSession(session) : false;

  const [[supplierRow], transactionRows, businessInfo, invoiceSettings] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.id, supplierId)),
    db
      .select()
      .from(supplierLedgerTransactions)
      .where(eq(supplierLedgerTransactions.supplierId, supplierId))
      .orderBy(asc(supplierLedgerTransactions.createdAt)),
    getBusinessSettings(),
    getInvoiceSettings(),
  ]);

  const purchaseIds = [
    ...new Set(transactionRows.map((r) => r.purchaseId).filter((id): id is string => id !== null)),
  ];
  const purchaseRows =
    purchaseIds.length > 0
      ? await db.select().from(purchases).where(inArray(purchases.id, purchaseIds))
      : [];
  const lineItemRows =
    purchaseIds.length > 0
      ? await db
          .select()
          .from(purchaseLineItems)
          .where(inArray(purchaseLineItems.purchaseId, purchaseIds))
          .orderBy(purchaseLineItems.sortOrder)
      : [];
  const lineItemsByPurchaseId = new Map<string, typeof lineItemRows>();
  for (const line of lineItemRows) {
    const existing = lineItemsByPurchaseId.get(line.purchaseId) ?? [];
    existing.push(line);
    lineItemsByPurchaseId.set(line.purchaseId, existing);
  }
  const purchaseById = new Map<string, Purchase>(
    purchaseRows.map((r) => [r.id, toPurchase(r, lineItemsByPurchaseId.get(r.id) ?? [])])
  );

  // Raw method/note (not the ledger's derived display note) for the Edit
  // Payment dialog to prefill correctly.
  const paymentIds = [
    ...new Set(transactionRows.map((r) => r.paymentId).filter((id): id is string => id !== null)),
  ];
  const paymentRows =
    paymentIds.length > 0
      ? await db
          .select({ id: supplierPayments.id, amount: supplierPayments.amount, method: supplierPayments.method, note: supplierPayments.note })
          .from(supplierPayments)
          .where(inArray(supplierPayments.id, paymentIds))
      : [];
  const paymentById = new Map(paymentRows.map((p) => [p.id, p]));

  // Effective date = the purchase's own purchaseDate for purchase/
  // purchase_void entries (a purchase dated in September belongs in
  // September even if entered in October) — everything else (payments,
  // opening balance) has no separate "event date" of its own, so
  // createdAt is already correct for those. Midday UTC, not midnight, so
  // this never sorts before a same-calendar-day payment/opening-balance
  // entry — same convention as the supplier statement generator.
  function effectiveDateIso(row: SupplierLedgerTransaction): string {
    if (row.purchaseId) {
      const purchase = purchaseById.get(row.purchaseId);
      if (purchase) return `${purchase.purchaseDate}T12:00:00.000Z`;
    }
    return row.createdAt;
  }

  const entries = transactionRows.map(toSupplierLedgerTransaction);
  const sorted = entries
    .map((entry) => ({ entry, effectiveDate: effectiveDateIso(entry) }))
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  let running = 0;
  const monthsByKey = new Map<string, LedgerMonthGroup>();
  for (const { entry, effectiveDate } of sorted) {
    running = Math.round((running + (entry.direction === "debit" ? entry.amount : -entry.amount)) * 100) / 100;
    const purchase = entry.type === "purchase" && entry.purchaseId ? purchaseById.get(entry.purchaseId) : undefined;
    const rawPayment =
      entry.type === "payment" && entry.paymentId ? paymentById.get(entry.paymentId) : undefined;
    const displayEntry = { ...entry, createdAt: effectiveDate };

    const monthKey = effectiveDate.slice(0, 7); // yyyy-mm
    let group = monthsByKey.get(monthKey);
    if (!group) {
      const [year, month] = monthKey.split("-").map(Number);
      const monthStart = `${monthKey}-01`;
      const monthEndDate = new Date(Date.UTC(year, month, 0)); // last day of month
      const monthEnd = monthEndDate.toISOString().slice(0, 10);
      group = {
        monthKey,
        monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
        monthStart,
        monthEnd,
        openingBalance: Math.round((running - (entry.direction === "debit" ? entry.amount : -entry.amount)) * 100) / 100,
        closingBalance: running,
        rows: [],
      };
      monthsByKey.set(monthKey, group);
    }
    group.closingBalance = running;
    group.rows.push({
      transaction: displayEntry,
      runningBalance: running,
      purchase,
      rawPayment: rawPayment
        ? { amount: Number(rawPayment.amount), method: rawPayment.method, note: rawPayment.note }
        : undefined,
    });
  }

  return (
    <LedgerViewClient
      supplierId={supplierId}
      supplier={supplierRow ? toSupplier(supplierRow) : null}
      months={[...monthsByKey.values()]}
      businessInfo={businessInfo}
      invoiceSettings={invoiceSettings}
      isOwner={isOwner}
    />
  );
}
