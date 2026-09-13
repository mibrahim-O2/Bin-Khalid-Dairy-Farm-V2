import "server-only";
import { toNumber } from "@/lib/money";
import type {
  animalCategories,
  animals,
  authorizedPeople,
  billLineItems,
  bills,
  customerExtraMilk,
  customerLedgerTransactions,
  customerMilkPauses,
  customerRates,
  customers,
  employeeLedgerTransactions,
  employeeLeaves,
  employeePayments,
  employees,
  employeeSalaryAccruals,
  employeeSalaryHistory,
  employeeStatements,
  farmSupplyItems,
  products,
  purchaseLineItems,
  purchases,
  supplierLedgerTransactions,
  supplierStatements,
  suppliers,
} from "./schema";
import type { Customer, CustomerExtraMilk, CustomerLedgerTransaction, CustomerMilkPause, CustomerRate, Product } from "@/types/customer";
import type { Bill, BillLineItem } from "@/types/bill";
import type { FarmSupplyItem, Supplier, SupplierLedgerTransaction } from "@/types/supplier";
import type { Purchase, PurchaseLineItem } from "@/types/purchase";
import type { SupplierStatement } from "@/types/supplier-statement";
import type { AuthorizedPerson, Employee, EmployeeLedgerTransaction } from "@/types/employee";
import type { EmployeeSalaryHistoryEntry } from "@/types/employee-salary";
import type { EmployeeSalaryAccrual } from "@/types/salary-accrual";
import type { EmployeeStatement } from "@/types/employee-statement";
import type { EmployeeLeave } from "@/types/employee-leave";
import type { EmployeePayment } from "@/types/employee-payment";
import type { Animal, AnimalCategory } from "@/types/livestock";

// Converts a Postgres row (numeric columns as strings, timestamps as Date
// objects) into the exact TS shape every existing component already
// expects (numbers, ISO date strings) — the same contract Firestore data
// used to satisfy, so nothing downstream needs to change.

export function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    whatsappNumber: row.whatsappNumber,
    address: row.address,
    joiningDate: row.joiningDate,
    dailyMilkQty: row.dailyMilkQty !== null ? toNumber(row.dailyMilkQty) : null,
    active: row.active,
    balance: toNumber(row.balance),
    hasOpeningBalance: row.hasOpeningBalance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdByUid ?? "",
  };
}

export function toCustomerMilkPause(row: typeof customerMilkPauses.$inferSelect): CustomerMilkPause {
  return {
    id: row.id,
    customerId: row.customerId,
    pauseDate: row.pauseDate,
    resumeDate: row.resumeDate,
    dailyMilkQtyAtPause: row.dailyMilkQtyAtPause !== null ? toNumber(row.dailyMilkQtyAtPause) : null,
    reducedDailyQty: row.reducedDailyQty !== null ? toNumber(row.reducedDailyQty) : null,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdByUid ?? "",
  };
}

export function toCustomerExtraMilk(row: typeof customerExtraMilk.$inferSelect): CustomerExtraMilk {
  return {
    id: row.id,
    customerId: row.customerId,
    date: row.date,
    quantity: toNumber(row.quantity),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
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

export function toSupplier(row: typeof suppliers.$inferSelect): Supplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    whatsappNumber: row.whatsappNumber,
    address: row.address,
    active: row.active,
    balance: toNumber(row.balance),
    hasOpeningBalance: row.hasOpeningBalance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdByUid ?? "",
  };
}

export function toFarmSupplyItem(row: typeof farmSupplyItems.$inferSelect): FarmSupplyItem {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    defaultRate: toNumber(row.defaultRate),
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPurchaseLineItem(row: typeof purchaseLineItems.$inferSelect): PurchaseLineItem {
  return {
    itemId: row.itemId,
    itemName: row.itemName,
    unit: row.unit,
    rate: toNumber(row.rate),
    quantity: toNumber(row.quantity),
    lineTotal: toNumber(row.lineTotal),
  };
}

/** `lineItemRows` must already be sorted by `sortOrder`. */
export function toPurchase(
  row: typeof purchases.$inferSelect,
  lineItemRows: (typeof purchaseLineItems.$inferSelect)[]
): Purchase {
  return {
    id: row.id,
    supplierId: row.supplierId,
    status: row.status,
    purchaseDate: row.purchaseDate,
    lineItems: lineItemRows.map(toPurchaseLineItem),
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
    replacesPurchaseId: row.replacesPurchaseId,
    replacedByPurchaseId: row.replacedByPurchaseId,
  };
}

export function toSupplierLedgerTransaction(
  row: typeof supplierLedgerTransactions.$inferSelect
): SupplierLedgerTransaction {
  return {
    id: row.id,
    supplierId: row.supplierId,
    type: row.type,
    direction: row.direction,
    amount: toNumber(row.amount),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    createdBy: { uid: row.createdByUid ?? "", email: row.createdByEmail },
    purchaseId: row.purchaseId ?? undefined,
    paymentId: row.paymentId ?? undefined,
  };
}

export function toSupplierStatement(row: typeof supplierStatements.$inferSelect): SupplierStatement {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    startDate: row.startDate,
    endDate: row.endDate,
    openingBalance: toNumber(row.openingBalance),
    closingBalance: toNumber(row.closingBalance),
    // Stored as jsonb — already the exact SupplierLedgerTransaction[] shape
    // at write time (see generateSupplierStatement), just numbers already.
    transactions: row.transactions as SupplierLedgerTransaction[],
    createdAt: row.createdAt.toISOString(),
    createdBy: { uid: row.createdByUid ?? "", email: row.createdByEmail },
  };
}

export function toEmployee(row: typeof employees.$inferSelect): Employee {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    whatsappNumber: row.whatsappNumber,
    address: row.address,
    joiningDate: row.joiningDate,
    active: row.active,
    balance: toNumber(row.balance),
    hasOpeningBalance: row.hasOpeningBalance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdByUid ?? "",
  };
}

export function toAuthorizedPerson(row: typeof authorizedPeople.$inferSelect): AuthorizedPerson {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toEmployeeSalaryHistoryEntry(
  row: typeof employeeSalaryHistory.$inferSelect
): EmployeeSalaryHistoryEntry {
  return {
    id: row.id,
    employeeId: row.employeeId,
    monthlySalary: toNumber(row.monthlySalary),
    effectiveFrom: row.effectiveFrom,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdByUid ?? "",
  };
}

export function toEmployeeSalaryAccrual(
  row: typeof employeeSalaryAccruals.$inferSelect
): EmployeeSalaryAccrual {
  return {
    id: row.id,
    employeeId: row.employeeId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    amount: toNumber(row.amount),
    note: row.note,
    status: row.status,
    leaveDaysDeducted: row.leaveDaysDeducted !== null ? toNumber(row.leaveDaysDeducted) : null,
    leaveAmountDeducted: row.leaveAmountDeducted !== null ? toNumber(row.leaveAmountDeducted) : null,
    createdAt: row.createdAt.toISOString(),
    createdBy: { uid: row.createdByUid ?? "", email: row.createdByEmail },
    voidedAt: row.voidedAt ? row.voidedAt.toISOString() : null,
    voidedBy: row.voidedByUid ? { uid: row.voidedByUid, email: row.voidedByEmail } : null,
    voidReason: row.voidReason,
  };
}

export function toEmployeeLeave(row: typeof employeeLeaves.$inferSelect): EmployeeLeave {
  return {
    id: row.id,
    employeeId: row.employeeId,
    leaveStartDate: row.leaveStartDate,
    resumeDate: row.resumeDate,
    dailyRateAtLeave: row.dailyRateAtLeave !== null ? toNumber(row.dailyRateAtLeave) : null,
    note: row.note,
    appliedToAccrualId: row.appliedToAccrualId,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdByUid ?? "",
  };
}

export function toEmployeePayment(row: typeof employeePayments.$inferSelect): EmployeePayment {
  return {
    id: row.id,
    employeeId: row.employeeId,
    amount: toNumber(row.amount),
    source: row.source,
    givenBy: row.givenBy,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    createdBy: { uid: row.createdByUid ?? "", email: row.createdByEmail },
    voidedAt: row.voidedAt ? row.voidedAt.toISOString() : null,
    voidedBy: row.voidedByUid ? { uid: row.voidedByUid, email: row.voidedByEmail } : null,
    voidReason: row.voidReason,
  };
}

export function toEmployeeLedgerTransaction(
  row: typeof employeeLedgerTransactions.$inferSelect
): EmployeeLedgerTransaction {
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type,
    direction: row.direction,
    amount: toNumber(row.amount),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    createdBy: { uid: row.createdByUid ?? "", email: row.createdByEmail },
    accrualId: row.accrualId ?? undefined,
    paymentId: row.paymentId ?? undefined,
  };
}

export function toEmployeeStatement(row: typeof employeeStatements.$inferSelect): EmployeeStatement {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    startDate: row.startDate,
    endDate: row.endDate,
    openingBalance: toNumber(row.openingBalance),
    closingBalance: toNumber(row.closingBalance),
    transactions: row.transactions as EmployeeLedgerTransaction[],
    createdAt: row.createdAt.toISOString(),
    createdBy: { uid: row.createdByUid ?? "", email: row.createdByEmail },
  };
}

export function toCustomerLedgerTransaction(
  row: typeof customerLedgerTransactions.$inferSelect
): CustomerLedgerTransaction {
  return {
    id: row.id,
    customerId: row.customerId,
    type: row.type,
    direction: row.direction,
    amount: toNumber(row.amount),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    createdBy: { uid: row.createdByUid ?? "", email: row.createdByEmail },
    billId: row.billId ?? undefined,
    paymentId: row.paymentId ?? undefined,
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

export function toAnimalCategory(row: typeof animalCategories.$inferSelect): AnimalCategory {
  return {
    id: row.id,
    name: row.name,
    topLevelGroup: row.topLevelGroup,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAnimal(
  row: typeof animals.$inferSelect,
  category: Pick<typeof animalCategories.$inferSelect, "name" | "topLevelGroup">
): Animal {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: category.name,
    categoryTopLevelGroup: category.topLevelGroup,
    name: row.name,
    gender: row.gender,
    acquisitionDate: row.acquisitionDate,
    status: row.status,
    saleDate: row.saleDate,
    salePrice: row.salePrice !== null ? toNumber(row.salePrice) : null,
    deceasedDate: row.deceasedDate,
    deceasedNote: row.deceasedNote,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdByUid ?? "",
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedByUid ?? "",
  };
}
