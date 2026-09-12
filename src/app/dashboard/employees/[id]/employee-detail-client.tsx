"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthorizedPerson, Employee, EmployeeLedgerTransaction } from "@/types/employee";
import type { EmployeeSalaryHistoryEntry } from "@/types/employee-salary";
import type { EmployeeSalaryAccrual } from "@/types/salary-accrual";
import type { EmployeeStatement } from "@/types/employee-statement";
import { formatAmount } from "@/lib/format-number";
import { EmployeeFormDialog } from "../employee-form-dialog";
import { setEmployeeActive } from "../crud-actions";
import { OpeningBalanceCard } from "./opening-balance-card";
import { SalaryCard } from "./salary-card";
import { AccrualsList } from "./accruals-list";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { StatementsCard } from "./statements-card";
import { DeleteEmployeeDialog } from "./delete-employee-dialog";

export function EmployeeDetailClient({
  isOwner,
  employee,
  salaryHistory,
  accruals,
  statements,
  openingBalanceEntry,
  authorizedPeople,
}: {
  isOwner: boolean;
  employee: Employee | null;
  salaryHistory: EmployeeSalaryHistoryEntry[];
  accruals: EmployeeSalaryAccrual[];
  statements: EmployeeStatement[];
  openingBalanceEntry: EmployeeLedgerTransaction | null;
  authorizedPeople: AuthorizedPerson[];
}) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);

  async function toggleActive() {
    if (!employee) return;
    setToggling(true);
    await setEmployeeActive({ employeeId: employee.id, active: !employee.active });
    setToggling(false);
    router.refresh();
  }

  if (employee === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">Employee not found.</p>
        <Link href="/dashboard/employees" className="text-sm text-primary hover:underline">
          Back to employees
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/employees"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to employees
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-foreground">{employee.name}</h1>
            <Badge variant={employee.active ? "default" : "secondary"}>
              {employee.active ? "Active" : "Archived"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <EmployeeFormDialog
              employee={employee}
              trigger={
                <Button variant="outline" size="sm">
                  Edit details
                </Button>
              }
            />
            <Button variant="outline" size="sm" disabled={toggling} onClick={toggleActive}>
              {employee.active ? "Archive" : "Unarchive"}
            </Button>
            {isOwner ? <DeleteEmployeeDialog employeeId={employee.id} employeeName={employee.name} /> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>
              <span className="text-muted-foreground">Phone: </span>
              {employee.phone ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Address: </span>
              {employee.address ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <CardTitle>Balance</CardTitle>
            <RecordPaymentDialog employeeId={employee.id} authorizedPeople={authorizedPeople} />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-bold text-foreground">
              {formatAmount(employee.balance)}
            </p>
            <p className="text-sm text-muted-foreground">
              {employee.balance > 0
                ? "Owed to the employee"
                : employee.balance < 0
                  ? "Employee has an advance"
                  : "Settled"}
            </p>
            <Link
              href={`/dashboard/employees/${employee.id}/ledger`}
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              View full ledger
            </Link>
          </CardContent>
        </Card>
      </div>

      <OpeningBalanceCard
        employeeId={employee.id}
        hasOpeningBalance={employee.hasOpeningBalance}
        entry={openingBalanceEntry}
      />

      <SalaryCard employeeId={employee.id} history={salaryHistory} />

      <AccrualsList employeeId={employee.id} accruals={accruals} salaryHistory={salaryHistory} />

      <StatementsCard employeeId={employee.id} statements={statements} />
    </div>
  );
}
