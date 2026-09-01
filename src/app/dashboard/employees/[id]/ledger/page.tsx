import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { authorizedPeople, employeeLedgerTransactions, employees, employeeSalaryHistory } from "@/lib/db/schema";
import { toAuthorizedPerson, toEmployee, toEmployeeLedgerTransaction, toEmployeeSalaryHistoryEntry } from "@/lib/db/mappers";
import { LedgerViewClient } from "./ledger-view-client";

export default async function EmployeeLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: employeeId } = await params;
  const db = getDb();

  const [[employeeRow], transactionRows, salaryHistoryRows, authorizedPeopleRows] = await Promise.all([
    db.select().from(employees).where(eq(employees.id, employeeId)),
    db
      .select()
      .from(employeeLedgerTransactions)
      .where(eq(employeeLedgerTransactions.employeeId, employeeId))
      .orderBy(asc(employeeLedgerTransactions.createdAt)),
    db
      .select()
      .from(employeeSalaryHistory)
      .where(eq(employeeSalaryHistory.employeeId, employeeId)),
    db.select().from(authorizedPeople).where(eq(authorizedPeople.active, true)),
  ]);

  return (
    <LedgerViewClient
      employeeId={employeeId}
      employeeName={employeeRow ? toEmployee(employeeRow).name : null}
      transactions={transactionRows.map(toEmployeeLedgerTransaction)}
      salaryHistory={salaryHistoryRows.map(toEmployeeSalaryHistoryEntry)}
      authorizedPeople={authorizedPeopleRows.map(toAuthorizedPerson)}
    />
  );
}
