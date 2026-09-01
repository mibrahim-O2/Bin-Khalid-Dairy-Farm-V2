import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  authorizedPeople,
  employeeLedgerTransactions,
  employees,
  employeeSalaryAccruals,
  employeeSalaryHistory,
  employeeStatements,
} from "@/lib/db/schema";
import {
  toAuthorizedPerson,
  toEmployee,
  toEmployeeLedgerTransaction,
  toEmployeeSalaryAccrual,
  toEmployeeSalaryHistoryEntry,
  toEmployeeStatement,
} from "@/lib/db/mappers";
import { EmployeeDetailClient } from "./employee-detail-client";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [
    [employeeRow],
    salaryHistoryRows,
    accrualRows,
    statementRows,
    [openingBalanceRow],
    authorizedPeopleRows,
  ] = await Promise.all([
    db.select().from(employees).where(eq(employees.id, id)),
    db
      .select()
      .from(employeeSalaryHistory)
      .where(eq(employeeSalaryHistory.employeeId, id))
      .orderBy(desc(employeeSalaryHistory.effectiveFrom)),
    db
      .select()
      .from(employeeSalaryAccruals)
      .where(eq(employeeSalaryAccruals.employeeId, id))
      .orderBy(desc(employeeSalaryAccruals.createdAt)),
    db
      .select()
      .from(employeeStatements)
      .where(eq(employeeStatements.employeeId, id))
      .orderBy(desc(employeeStatements.createdAt)),
    db
      .select()
      .from(employeeLedgerTransactions)
      .where(
        and(eq(employeeLedgerTransactions.employeeId, id), eq(employeeLedgerTransactions.type, "opening_balance"))
      )
      .limit(1),
    db.select().from(authorizedPeople).where(eq(authorizedPeople.active, true)).orderBy(asc(authorizedPeople.name)),
  ]);

  return (
    <EmployeeDetailClient
      employee={employeeRow ? toEmployee(employeeRow) : null}
      salaryHistory={salaryHistoryRows.map(toEmployeeSalaryHistoryEntry)}
      accruals={accrualRows.map(toEmployeeSalaryAccrual)}
      statements={statementRows.map(toEmployeeStatement)}
      openingBalanceEntry={openingBalanceRow ? toEmployeeLedgerTransaction(openingBalanceRow) : null}
      authorizedPeople={authorizedPeopleRows.map(toAuthorizedPerson)}
    />
  );
}
