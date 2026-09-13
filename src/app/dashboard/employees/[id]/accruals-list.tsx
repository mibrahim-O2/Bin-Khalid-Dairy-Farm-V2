"use client";

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
import type { EmployeeSalaryHistoryEntry } from "@/types/employee-salary";
import { RecordAccrualDialog } from "./record-accrual-dialog";
import { EditAccrualDialog } from "./edit-accrual-dialog";
import { DeleteAccrualDialog } from "./delete-accrual-dialog";

const statusVariant: Record<SalaryAccrualStatus, "default" | "destructive"> = {
  finalized: "default",
  void: "destructive",
};

export function AccrualsList({
  employeeId,
  accruals,
  salaryHistory,
  isOwner,
}: {
  employeeId: string;
  accruals: EmployeeSalaryAccrual[];
  salaryHistory: EmployeeSalaryHistoryEntry[];
  isOwner: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">Salary accruals</h2>
          <RecordAccrualDialog employeeId={employeeId} salaryHistory={salaryHistory} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Leave</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accruals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                    <TableCell className="text-muted-foreground">
                      {accrual.leaveDaysDeducted
                        ? `${accrual.leaveDaysDeducted}d / ${formatAmount(accrual.leaveAmountDeducted ?? 0)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[accrual.status]} className="capitalize">
                        {accrual.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {accrual.status === "finalized" ? (
                        <div className="flex justify-end gap-2">
                          <EditAccrualDialog accrual={accrual} />
                          {isOwner ? <DeleteAccrualDialog accrualId={accrual.id} /> : null}
                        </div>
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
