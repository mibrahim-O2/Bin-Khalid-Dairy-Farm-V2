"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
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
import type { Employee, EmployeeLedgerTransaction } from "@/types/employee";
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

export default function EmployeeLedgerPage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const { user } = useCurrentUser();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [transactions, setTransactions] = useState<EmployeeLedgerTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    return onSnapshot(
      doc(db, "employees", employeeId),
      (snap) => {
        setEmployee(snap.exists() ? ({ id: snap.id, ...snap.data() } as Employee) : null);
      },
      () => setError("Failed to load the employee. Try refreshing the page.")
    );
  }, [employeeId, user]);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const q = query(
      collection(db, "employeeLedgerTransactions"),
      where("employeeId", "==", employeeId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as EmployeeLedgerTransaction)
          .reverse();
        setTransactions(docs);
      },
      () => setError("Failed to load the ledger. Try refreshing the page.")
    );
  }, [employeeId, user]);

  // Reversed vs customers/suppliers: credit increases the running balance.
  const rows = useMemo(() => {
    if (!transactions) return null;
    let running = 0;
    return transactions.map((entry) => {
      running += entry.direction === "credit" ? entry.amount : -entry.amount;
      return { entry, runningBalance: Math.round(running * 100) / 100 };
    });
  }, [transactions]);

  const voidedPaymentIds = useMemo(() => {
    if (!transactions) return new Set<string>();
    return new Set(
      transactions.filter((t) => t.type === "payment_void" && t.paymentId).map((t) => t.paymentId!)
    );
  }, [transactions]);

  const voidedAccrualIds = useMemo(() => {
    if (!transactions) return new Set<string>();
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
          <ArrowLeft className="size-4" /> Back to {employee?.name ?? "employee"}
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
            <RecordAccrualDialog employeeId={employeeId} />
            <RecordPaymentDialog employeeId={employeeId} />
          </div>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

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
                {rows === null ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
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
