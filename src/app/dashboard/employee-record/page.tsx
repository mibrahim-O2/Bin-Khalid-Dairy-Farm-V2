import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { employeeLeaves, employees, employeeSalaryHistory } from "@/lib/db/schema";
import { toEmployee, toEmployeeLeave, toEmployeeSalaryHistoryEntry } from "@/lib/db/mappers";
import { EmployeeRecordTable } from "./employee-record-table";

// Server Component — one-time fetch at request time, matching every other
// list page in the app (see Milk Record page for the pattern this mirrors).
export default async function EmployeeRecordPage() {
  const db = getDb();
  const session = await getServerSession();
  const isOwner = session ? isOwnerSession(session) : false;

  const [employeeRows, leaveRows, salaryHistoryRows] = await Promise.all([
    db.select().from(employees).where(eq(employees.active, true)).orderBy(asc(employees.name)),
    db.select().from(employeeLeaves).orderBy(desc(employeeLeaves.leaveStartDate)),
    db.select().from(employeeSalaryHistory),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Employee Record</h1>
        <p className="text-sm text-muted-foreground">
          Track employee leave periods over time. Once a leave is resumed, its deduction can be
          pulled into that period&apos;s salary accrual — see the employee&apos;s ledger.
        </p>
      </div>
      <EmployeeRecordTable
        employees={employeeRows.map(toEmployee)}
        leaves={leaveRows.map(toEmployeeLeave)}
        salaryHistory={salaryHistoryRows.map(toEmployeeSalaryHistoryEntry)}
        isOwner={isOwner}
      />
    </div>
  );
}
