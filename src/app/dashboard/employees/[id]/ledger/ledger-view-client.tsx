"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { AuthorizedPerson, EmployeeLedgerTransaction } from "@/types/employee";
import type { EmployeeSalaryHistoryEntry } from "@/types/employee-salary";
import { VoidPaymentDialog } from "../void-payment-dialog";
import { VoidAccrualDialog } from "../void-accrual-dialog";
import { RecordPaymentDialog } from "../record-payment-dialog";
import { RecordAccrualDialog } from "../record-accrual-dialog";

const typeLabels: Record<EmployeeLedgerTransaction["type"], string> = {
  opening_balance: "Opening Balance",
  salary_accrual: "Salary Accrual",
  salary_accrual_void: "Salary Accrual Void",
  payment: "Payment",
  payment_void: "Payment Void",
};

export function LedgerViewClient({
  employeeId,
  employeeName,
  transactions,
  salaryHistory,
  authorizedPeople,
}: {
  employeeId: string;
  employeeName: string | null;
  transactions: EmployeeLedgerTransaction[];
  salaryHistory: EmployeeSalaryHistoryEntry[];
  authorizedPeople: AuthorizedPerson[];
}) {
  // Reversed vs customers/suppliers: credit increases the running balance.
  const rows = useMemo(() => {
    let running = 0;
    return transactions.map((entry) => {
      running += entry.direction === "credit" ? entry.amount : -entry.amount;
      return { entry, runningBalance: Math.round(running * 100) / 100 };
    });
  }, [transactions]);

  const voidedPaymentIds = useMemo(() => {
    return new Set(
      transactions.filter((t) => t.type === "payment_void" && t.paymentId).map((t) => t.paymentId!)
    );
  }, [transactions]);

  const voidedAccrualIds = useMemo(() => {
    return new Set(
      transactions
        .filter((t) => t.type === "salary_accrual_void" && t.accrualId)
        .map((t) => t.accrualId!)
    );
  }, [transactions]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/employees/${employeeId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {employeeName ?? "employee"}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Employee Ledger</h1>
            <p className="text-sm text-muted-foreground">
              Every transaction, oldest first, with the running balance after each one. This is
              a read-only history — to record a salary accrual or an advance/payment, use the
              buttons here or on the employee&apos;s page.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <RecordAccrualDialog employeeId={employeeId} salaryHistory={salaryHistory} />
            <RecordPaymentDialog employeeId={employeeId} authorizedPeople={authorizedPeople} />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No transactions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ entry, runningBalance }) => {
                    const isVoidedPayment =
                      entry.type === "payment" &&
                      !!entry.paymentId &&
                      voidedPaymentIds.has(entry.paymentId);
                    const isVoidedAccrual =
                      entry.type === "salary_accrual" &&
                      !!entry.accrualId &&
                      voidedAccrualIds.has(entry.accrualId);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.createdAt)}</TableCell>
                        <TableCell className="font-medium text-foreground">
                          {typeLabels[entry.type]}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.note}
                          {isVoidedPayment || isVoidedAccrual ? (
                            <Badge variant="destructive" className="ml-2">
                              Voided
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {entry.direction === "debit" ? formatAmount(entry.amount) : "—"}
                        </TableCell>
                        <TableCell>
                          {entry.direction === "credit" ? formatAmount(entry.amount) : "—"}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatAmount(runningBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.type === "payment" && entry.paymentId && !isVoidedPayment ? (
                            <VoidPaymentDialog paymentId={entry.paymentId} />
                          ) : entry.type === "salary_accrual" && entry.accrualId && !isVoidedAccrual ? (
                            <VoidAccrualDialog accrualId={entry.accrualId} />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
