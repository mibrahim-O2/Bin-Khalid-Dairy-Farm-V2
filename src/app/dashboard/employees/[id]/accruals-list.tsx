"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import type { EmployeeSalaryAccrual, SalaryAccrualStatus } from "@/types/salary-accrual";
import { RecordAccrualDialog } from "./record-accrual-dialog";
import { VoidAccrualDialog } from "./void-accrual-dialog";

const statusVariant: Record<SalaryAccrualStatus, "default" | "destructive"> = {
  finalized: "default",
  void: "destructive",
};

export function AccrualsList({ employeeId }: { employeeId: string }) {
  const { user } = useCurrentUser();
  const [accruals, setAccruals] = useState<EmployeeSalaryAccrual[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const q = query(
      collection(db, "employeeSalaryAccruals"),
      where("employeeId", "==", employeeId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      q,
      (snapshot) => {
        setAccruals(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as EmployeeSalaryAccrual));
      },
      () => setError("Failed to load salary accruals. Try refreshing the page.")
    );
  }, [employeeId, user]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">Salary accruals</h2>
          <RecordAccrualDialog employeeId={employeeId} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accruals === null ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : accruals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No salary accruals yet.
                  </TableCell>
                </TableRow>
              ) : (
                accruals.map((accrual) => (
                  <TableRow key={accrual.id}>
                    <TableCell className="font-medium text-foreground">
                      {formatDate(accrual.periodStart)} – {formatDate(accrual.periodEnd)}
                    </TableCell>
                    <TableCell>{formatAmount(accrual.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[accrual.status]} className="capitalize">
                        {accrual.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {accrual.status === "finalized" ? (
                        <VoidAccrualDialog accrualId={accrual.id} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
