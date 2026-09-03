import "server-only";
import { and, eq, gte, isNull, lt, sql, type SQLWrapper } from "drizzle-orm";
import { getDb } from "./client";
import {
  bills,
  billLineItems,
  customers,
  employees,
  payments,
  purchases,
  suppliers,
} from "./schema";
import { toNumber } from "@/lib/money";

export type DashboardStats = {
  activeCustomers: number;
  customerOutstanding: number;
  activeSuppliers: number;
  supplierPayable: number;
  activeEmployees: number;
  employeeNetOwed: number;
  milkVolumeThisMonth: number;
  milkRevenueThisMonth: number;
  purchasesThisMonth: number;
  paymentsReceivedThisMonth: number;
};

/** [start, end) for the current calendar month, UTC — matches this app's
 *  other date-boundary logic (no local-timezone drift). */
function currentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/**
 * Every number here is a live, uncached query at request time — no
 * denormalized "dashboard totals" row to keep in sync, since the app's
 * data volume doesn't call for that yet. Read-only: this module never
 * writes anything, matching the dashboard's "reference only" nature.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb();
  const { start, end } = currentMonthRange();

  // "Outstanding"/"payable" only counts positive balances — a customer or
  // supplier sitting on a credit (rare, e.g. an overpayment) isn't netted
  // against everyone else's debt; it's a separate, smaller story than
  // "how much are we owed right now."
  const positiveBalanceSum = (balanceCol: SQLWrapper) =>
    sql<string>`coalesce(sum(case when ${balanceCol} > 0 then ${balanceCol} else 0 end), 0)`;

  const [
    [customerAgg],
    [supplierAgg],
    [employeeAgg],
    [milkAgg],
    [purchaseAgg],
    [paymentAgg],
  ] = await Promise.all([
    db
      .select({ count: sql<string>`count(*)`, outstanding: positiveBalanceSum(customers.balance) })
      .from(customers)
      .where(eq(customers.active, true)),
    db
      .select({ count: sql<string>`count(*)`, payable: positiveBalanceSum(suppliers.balance) })
      .from(suppliers)
      .where(eq(suppliers.active, true)),
    db
      .select({ count: sql<string>`count(*)`, netOwed: positiveBalanceSum(employees.balance) })
      .from(employees)
      .where(eq(employees.active, true)),
    db
      .select({
        volume: sql<string>`coalesce(sum(${billLineItems.totalQty}), 0)`,
        revenue: sql<string>`coalesce(sum(${billLineItems.lineTotal}), 0)`,
      })
      .from(billLineItems)
      .innerJoin(bills, eq(bills.id, billLineItems.billId))
      .where(
        and(
          eq(bills.status, "finalized"),
          eq(billLineItems.billingType, "milk"),
          gte(bills.finalizedAt, start),
          lt(bills.finalizedAt, end)
        )
      ),
    db
      .select({ total: sql<string>`coalesce(sum(${purchases.subtotal}), 0)` })
      .from(purchases)
      .where(and(eq(purchases.status, "finalized"), gte(purchases.finalizedAt, start), lt(purchases.finalizedAt, end))),
    db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(and(isNull(payments.voidedAt), gte(payments.createdAt, start), lt(payments.createdAt, end))),
  ]);

  return {
    activeCustomers: Number(customerAgg.count),
    customerOutstanding: toNumber(customerAgg.outstanding),
    activeSuppliers: Number(supplierAgg.count),
    supplierPayable: toNumber(supplierAgg.payable),
    activeEmployees: Number(employeeAgg.count),
    employeeNetOwed: toNumber(employeeAgg.netOwed),
    milkVolumeThisMonth: toNumber(milkAgg.volume),
    milkRevenueThisMonth: toNumber(milkAgg.revenue),
    purchasesThisMonth: toNumber(purchaseAgg.total),
    paymentsReceivedThisMonth: toNumber(paymentAgg.total),
  };
}
