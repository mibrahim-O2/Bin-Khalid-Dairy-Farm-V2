"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
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
import type { Customer, CustomerLedgerTransaction } from "@/types/customer";
import { VoidPaymentDialog } from "./void-payment-dialog";
import { RecordPaymentDialog } from "../record-payment-dialog";
import { createDraftBill } from "../bills/actions";

const typeLabels: Record<CustomerLedgerTransaction["type"], string> = {
  opening_balance: "Opening Balance",
  bill: "Bill",
  bill_void: "Bill Void",
  payment: "Payment",
  payment_void: "Payment Void",
};

export default function CustomerLedgerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const customerId = params.id;
  const { user } = useCurrentUser();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<CustomerLedgerTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatingBill, setCreatingBill] = useState(false);

  async function handleNewBill() {
    setCreatingBill(true);
    try {
      const result = await createDraftBill(customerId);
      if (result.ok) {
        router.push(`/dashboard/customers/${customerId}/bills/${result.billId}`);
      } else {
        setError(result.error);
      }
    } finally {
      setCreatingBill(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    return onSnapshot(
      doc(db, "customers", customerId),
      (snap) => {
        setCustomer(snap.exists() ? ({ id: snap.id, ...snap.data() } as Customer) : null);
      },
      () => setError("Failed to load the customer. Try refreshing the page.")
    );
  }, [customerId, user]);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    // Reuses the existing customerId+createdAt(desc) index — reversed to
    // chronological order below rather than needing a second index.
    const q = query(
      collection(db, "customerLedgerTransactions"),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CustomerLedgerTransaction)
          .reverse();
        setTransactions(docs);
      },
      () => setError("Failed to load the ledger. Try refreshing the page.")
    );
  }, [customerId, user]);

  const rows = useMemo(() => {
    if (!transactions) return null;
    let running = 0;
    return transactions.map((entry) => {
      running += entry.direction === "debit" ? entry.amount : -entry.amount;
      return { entry, runningBalance: Math.round(running * 100) / 100 };
    });
  }, [transactions]);

  // A payment already has a reversing "payment_void" entry — infer that from
  // the ledger itself (already loaded) rather than fetching /payments too.
  const voidedPaymentIds = useMemo(() => {
    if (!transactions) return new Set<string>();
    return new Set(
      transactions.filter((t) => t.type === "payment_void" && t.paymentId).map((t) => t.paymentId!)
    );
  }, [transactions]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/customers/${customerId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {customer?.name ?? "customer"}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Customer Ledger</h1>
            <p className="text-sm text-muted-foreground">
              Every transaction, oldest first, with the running balance after each one. This is
              a read-only history — to record a new bill or payment, use the buttons here or on
              the customer&apos;s page.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" disabled={creatingBill || !user} onClick={handleNewBill}>
              New bill
            </Button>
            <RecordPaymentDialog customerId={customerId} />
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
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.createdAt)}</TableCell>
                        <TableCell className="font-medium text-foreground">
                          {typeLabels[entry.type]}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.note}
                          {isVoidedPayment ? (
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
