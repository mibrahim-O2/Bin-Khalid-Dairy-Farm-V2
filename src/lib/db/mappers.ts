import "server-only";
import { toNumber } from "@/lib/money";
import type { billLineItems, bills, customerRates, customers, products } from "./schema";
import type { Customer, CustomerRate, Product } from "@/types/customer";
import type { Bill, BillLineItem } from "@/types/bill";

// Converts a Postgres row (numeric columns as strings, timestamps as Date
// objects) into the exact TS shape every existing component already
// expects (numbers, ISO date strings) — the same contract Firestore data
// used to satisfy, so nothing downstream needs to change.

export function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    active: row.active,
    balance: toNumber(row.balance),
    hasOpeningBalance: row.hasOpeningBalance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdByUid ?? "",
  };
}

export function toProduct(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    billingType: row.billingType,
    defaultRate: toNumber(row.defaultRate),
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCustomerRate(row: typeof customerRates.$inferSelect): CustomerRate {
  return {
    id: row.id,
    customerId: row.customerId,
    productId: row.productId,
    rate: toNumber(row.rate),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedByUid ?? "",
  };
}

export function toBillLineItem(row: typeof billLineItems.$inferSelect): BillLineItem {
  return {
    productId: row.productId,
    productName: row.productName,
    unit: row.unit,
    billingType: row.billingType,
    rate: toNumber(row.rate),
    dailyQty: row.dailyQty === null ? undefined : toNumber(row.dailyQty),
    extra: row.extra === null ? undefined : toNumber(row.extra),
    less: row.less === null ? undefined : toNumber(row.less),
    quantity: row.quantity === null ? undefined : toNumber(row.quantity),
    totalQty: toNumber(row.totalQty),
    lineTotal: toNumber(row.lineTotal),
  };
}

/** `lineItemRows` must already be sorted by `sortOrder` — see the query in
 *  bills/[billId]/page.tsx and bills-list.tsx's callers. */
export function toBill(row: typeof bills.$inferSelect, lineItemRows: (typeof billLineItems.$inferSelect)[]): Bill {
  return {
    id: row.id,
    customerId: row.customerId,
    billNumber: row.billNumber,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    days: row.days,
    lineItems: lineItemRows.map(toBillLineItem),
    subtotal: toNumber(row.subtotal),
    previousBalance: row.previousBalance === null ? null : toNumber(row.previousBalance),
    totalPayable: row.totalPayable === null ? null : toNumber(row.totalPayable),
    amountPaid: toNumber(row.amountPaid),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdByUid ?? "",
    finalizedAt: row.finalizedAt ? row.finalizedAt.toISOString() : null,
    finalizedBy: row.finalizedByUid ? { uid: row.finalizedByUid, email: row.finalizedByEmail } : null,
    voidedAt: row.voidedAt ? row.voidedAt.toISOString() : null,
    voidedBy: row.voidedByUid ? { uid: row.voidedByUid, email: row.voidedByEmail } : null,
    voidReason: row.voidReason,
    replacesBillId: row.replacesBillId,
    replacedByBillId: row.replacedByBillId,
  };
}
