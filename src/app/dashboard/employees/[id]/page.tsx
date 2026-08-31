"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Employee } from "@/types/employee";
import { formatAmount } from "@/lib/format-number";
import { EmployeeFormDialog } from "../employee-form-dialog";
import { OpeningBalanceCard } from "./opening-balance-card";
import { SalaryCard } from "./salary-card";
import { AccrualsList } from "./accruals-list";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { StatementsCard } from "./statements-card";

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const { user } = useCurrentUser();
  const [employee, setEmployee] = useState<Employee | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    return onSnapshot(
      doc(db, "employees", employeeId),
      (snap) => {
        setEmployee(snap.exists() ? ({ id: snap.id, ...snap.data() } as Employee) : null);
      },
      () => setLoadError("Failed to load this employee. Try refreshing the page.")
    );
  }, [employeeId, user]);

  async function toggleActive() {
    if (!employee) return;
    const db = getFirebaseDb();
    await updateDoc(doc(db, "employees", employee.id), {
      active: !employee.active,
      updatedAt: new Date().toISOString(),
    });
  }

  if (loadError) {
    return <p className="text-destructive">{loadError}</p>;
  }

  if (employee === undefined) {
    return <p className="text-muted-foreground">Loading…</p>;
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
            <Button variant="outline" size="sm" onClick={toggleActive}>
              {employee.active ? "Archive" : "Unarchive"}
            </Button>
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
            <RecordPaymentDialog employeeId={employee.id} />
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

      <OpeningBalanceCard employeeId={employee.id} hasOpeningBalance={employee.hasOpeningBalance} />

      <SalaryCard employeeId={employee.id} />

      <AccrualsList employeeId={employee.id} />

      <StatementsCard employeeId={employee.id} />
    </div>
  );
}
