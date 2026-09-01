import "server-only";
import { toNumber } from "@/lib/money";
import type { customerRates, customers, products } from "./schema";
import type { Customer, CustomerRate, Product } from "@/types/customer";

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
