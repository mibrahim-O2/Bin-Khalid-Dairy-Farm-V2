import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import {
  authorizedPeople,
  employeeLedgerTransactions,
  employeePayments,
  employees,
  employeeSalaryAccruals,
  employeeSalaryHistory,
} from "@/lib/db/schema";
import {
  toAuthorizedPerson,
  toEmployee,
  toEmployeeLedgerTransaction,
  toEmployeePayment,
  toEmployeeSalaryAccrual,
  toEmployeeSalaryHistoryEntry,
} from "@/lib/db/mappers";
import { getBusinessSettings, getInvoiceSettings } from "@/lib/db/settings";
import type { EmployeeLedgerTransaction } from "@/types/employee";
import type { EmployeePayment } from "@/types/employee-payment";
import { LedgerViewClient, type LedgerMonthGroup } from "./ledger-view-client";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function EmployeeLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: employeeId } = await params;
  const db = getDb();
  const session = await getServerSession();
  const isOwner = session ? isOwnerSession(session) : false;

  const [[employeeRow], transactionRows, salaryHistoryRows, authorizedPeopleRows, businessInfo, invoiceSettings] =
    await Promise.all([
      db.select().from(employees).where(eq(employees.id, employeeId)),
      db
        .select()
        .from(employeeLedgerTransactions)
        .where(eq(employeeLedgerTransactions.employeeId, employeeId))
        .orderBy(asc(employeeLedgerTransactions.createdAt)),
      db.select().from(employeeSalaryHistory).where(eq(employeeSalaryHistory.employeeId, employeeId)),
      db.select().from(authorizedPeople).where(eq(authorizedPeople.active, true)),
      getBusinessSettings(),
      getInvoiceSettings(),
    ]);

  const accrualIds = [...new Set(transactionRows.map((r) => r.accrualId).filter((id): id is string => id !== null))];
  const accrualRows = accrualIds.length > 0 ? await db.select().from(employeeSalaryAccruals).where(inArray(employeeSalaryAccruals.id, accrualIds)) : [];
  const accrualById = new Map(accrualRows.map((r) => [r.id, toEmployeeSalaryAccrual(r)]));

  const paymentIds = [...new Set(transactionRows.map((r) => r.paymentId).filter((id): id is string => id !== null))];
  const paymentRows = paymentIds.length > 0 ? await db.select().from(employeePayments).where(inArray(employeePayments.id, paymentIds)) : [];
  const paymentById = new Map<string, EmployeePayment>(paymentRows.map((r) => [r.id, toEmployeePayment(r)]));

  // Effective date = the accrual's own periodEnd for salary_accrual/
  // salary_accrual_void entries (a payroll period entered late still
  // belongs to the month it actually covers) — same fix as
  // generateEmployeeStatement. Payments/opening balance have no separate
  // event date, so createdAt is already correct for those. Midday UTC so
  // this never sorts before a same-calendar-day payment.
  function effectiveDateIso(entry: EmployeeLedgerTransaction): string {
    if (entry.accrualId) {
      const accrual = accrualById.get(entry.accrualId);
      if (accrual) return `${accrual.periodEnd}T12:00:00.000Z`;
    }
    return entry.createdAt;
  }

  const entries = transactionRows.map(toEmployeeLedgerTransaction).map((entry) => {
    // Leave figures live on the accrual row, not this ledger row — join
    // them in here so every consumer of these entries (this page, the
    // per-month ad-hoc statement, generateEmployeeStatement) can display
    // them without re-deriving anything.
    if (entry.accrualId) {
      const accrual = accrualById.get(entry.accrualId);
      if (accrual && accrual.leaveDaysDeducted) {
        return { ...entry, leaveDaysDeducted: accrual.leaveDaysDeducted, leaveAmountDeducted: accrual.leaveAmountDeducted ?? undefined };
      }
    }
    return entry;
  });

  const sorted = entries
    .map((entry) => ({ entry, effectiveDate: effectiveDateIso(entry) }))
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  // Reversed vs customers/suppliers: credit increases the running balance.
  let running = 0;
  const monthsByKey = new Map<string, LedgerMonthGroup>();
  for (const { entry, effectiveDate } of sorted) {
    running = Math.round((running + (entry.direction === "credit" ? entry.amount : -entry.amount)) * 100) / 100;
    const payment = entry.paymentId ? paymentById.get(entry.paymentId) : undefined;
    const displayEntry = { ...entry, createdAt: effectiveDate };

    const monthKey = effectiveDate.slice(0, 7); // yyyy-mm
    let group = monthsByKey.get(monthKey);
    if (!group) {
      const [year, month] = monthKey.split("-").map(Number);
      const monthStart = `${monthKey}-01`;
      const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      group = {
        monthKey,
        monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
        monthStart,
        monthEnd,
        openingBalance: Math.round((running - (entry.direction === "credit" ? entry.amount : -entry.amount)) * 100) / 100,
        closingBalance: running,
        rows: [],
      };
      monthsByKey.set(monthKey, group);
    }
    const accrual = entry.accrualId ? accrualById.get(entry.accrualId) : undefined;
    group.closingBalance = running;
    group.rows.push({ transaction: displayEntry, runningBalance: running, payment, accrual });
  }

  return (
    <LedgerViewClient
      employeeId={employeeId}
      employeeName={employeeRow ? toEmployee(employeeRow).name : null}
      employeeWhatsappNumber={employeeRow ? toEmployee(employeeRow).whatsappNumber : null}
      employeePhone={employeeRow ? toEmployee(employeeRow).phone : null}
      months={[...monthsByKey.values()]}
      salaryHistory={salaryHistoryRows.map(toEmployeeSalaryHistoryEntry)}
      authorizedPeople={authorizedPeopleRows.map(toAuthorizedPerson)}
      businessInfo={businessInfo}
      invoiceSettings={invoiceSettings}
      isOwner={isOwner}
    />
  );
}
