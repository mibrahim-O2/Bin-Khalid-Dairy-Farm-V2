import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { billLineItems, bills, customerLedgerTransactions, customers, payments } from "@/lib/db/schema";
import { toBill, toCustomer, toCustomerLedgerTransaction } from "@/lib/db/mappers";
import { getBusinessSettings, getInvoiceSettings, getPaymentSettings } from "@/lib/db/settings";
import type { Bill } from "@/types/bill";
import type { CustomerLedgerTransaction } from "@/types/customer";
import { LedgerViewClient, type LedgerMonthGroup } from "./ledger-view-client";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function CustomerLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = await params;
  const db = getDb();
  const session = await getServerSession();
  const isOwner = session ? isOwnerSession(session) : false;

  const [[customerRow], transactionRows, businessInfo, invoiceSettings, paymentSettings] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, customerId)),
    db
      .select()
      .from(customerLedgerTransactions)
      .where(eq(customerLedgerTransactions.customerId, customerId))
      .orderBy(asc(customerLedgerTransactions.createdAt)),
    getBusinessSettings(),
    getInvoiceSettings(),
    getPaymentSettings(),
  ]);

  const billIds = [
    ...new Set(transactionRows.map((r) => r.billId).filter((id): id is string => id !== null)),
  ];
  const billRows =
    billIds.length > 0 ? await db.select().from(bills).where(inArray(bills.id, billIds)) : [];
  const lineItemRows =
    billIds.length > 0
      ? await db
          .select()
          .from(billLineItems)
          .where(inArray(billLineItems.billId, billIds))
          .orderBy(billLineItems.sortOrder)
      : [];
  const lineItemsByBillId = new Map<string, typeof lineItemRows>();
  for (const line of lineItemRows) {
    const existing = lineItemsByBillId.get(line.billId) ?? [];
    existing.push(line);
    lineItemsByBillId.set(line.billId, existing);
  }
  const billById = new Map<string, Bill>(
    billRows.map((r) => [r.id, toBill(r, lineItemsByBillId.get(r.id) ?? [])])
  );

  const paymentIds = [
    ...new Set(transactionRows.map((r) => r.paymentId).filter((id): id is string => id !== null)),
  ];
  const paymentRows =
    paymentIds.length > 0
      ? await db
          .select({ id: payments.id, amount: payments.amount, method: payments.method, note: payments.note })
          .from(payments)
          .where(inArray(payments.id, paymentIds))
      : [];
  const paymentById = new Map(paymentRows.map((p) => [p.id, p]));

  // Effective date = the bill's own endDate for bill/bill_void entries (a
  // bill for a period ending in September belongs in September even if
  // entered/finalized in October) — everything else has no separate
  // "event date" of its own, so createdAt is already correct for those.
  function effectiveDateIso(row: CustomerLedgerTransaction): string {
    if (row.billId) {
      const bill = billById.get(row.billId);
      if (bill) return `${bill.endDate}T12:00:00.000Z`;
    }
    return row.createdAt;
  }

  const entries = transactionRows.map(toCustomerLedgerTransaction);
  const sorted = entries
    .map((entry) => ({ entry, effectiveDate: effectiveDateIso(entry) }))
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  let running = 0;
  const monthsByKey = new Map<string, LedgerMonthGroup>();
  for (const { entry, effectiveDate } of sorted) {
    running = Math.round((running + (entry.direction === "debit" ? entry.amount : -entry.amount)) * 100) / 100;
    const bill = entry.type === "bill" && entry.billId ? billById.get(entry.billId) : undefined;
    const rawPayment =
      entry.type === "payment" && entry.paymentId ? paymentById.get(entry.paymentId) : undefined;
    const displayEntry = { ...entry, createdAt: effectiveDate };

    const monthKey = effectiveDate.slice(0, 7); // yyyy-mm
    let group = monthsByKey.get(monthKey);
    if (!group) {
      const [year, month] = monthKey.split("-").map(Number);
      const monthStart = `${monthKey}-01`;
      const monthEndDate = new Date(Date.UTC(year, month, 0));
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
      bill,
      rawPayment: rawPayment
        ? { amount: Number(rawPayment.amount), method: rawPayment.method, note: rawPayment.note }
        : undefined,
    });
  }

  return (
    <LedgerViewClient
      customerId={customerId}
      customer={customerRow ? toCustomer(customerRow) : null}
      months={[...monthsByKey.values()]}
      businessInfo={businessInfo}
      invoiceSettings={invoiceSettings}
      paymentSettings={paymentSettings}
      isOwner={isOwner}
    />
  );
}
