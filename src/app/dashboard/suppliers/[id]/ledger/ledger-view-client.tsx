"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import type { SupplierLedgerTransaction } from "@/types/supplier";
import { VoidPaymentDialog } from "./void-payment-dialog";
import { RecordPaymentDialog } from "../record-payment-dialog";
import { createDraftPurchase } from "../purchases/actions";

const typeLabels: Record<SupplierLedgerTransaction["type"], string> = {
  opening_balance: "Opening Balance",
  purchase: "Purchase",
  purchase_void: "Purchase Void",
  payment: "Payment",
  payment_void: "Payment Void",
};

export function LedgerViewClient({
  supplierId,
  supplierName,
  transactions,
}: {
  supplierId: string;
  supplierName: string | null;
  transactions: SupplierLedgerTransaction[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [creatingPurchase, setCreatingPurchase] = useState(false);

  async function handleNewPurchase() {
    setCreatingPurchase(true);
    try {
      const result = await createDraftPurchase(supplierId);
      if (result.ok) {
        router.push(`/dashboard/suppliers/${supplierId}/purchases/${result.purchaseId}`);
      } else {
        setError(result.error);
      }
    } finally {
      setCreatingPurchase(false);
    }
  }

  const rows = useMemo(() => {
    let running = 0;
    return transactions.map((entry) => {
      running += entry.direction === "debit" ? entry.amount : -entry.amount;
      return { entry, runningBalance: Math.round(running * 100) / 100 };
    });
  }, [transactions]);

  const voidedPaymentIds = useMemo(() => {
    return new Set(
      transactions.filter((t) => t.type === "payment_void" && t.paymentId).map((t) => t.paymentId!)
    );
  }, [transactions]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/suppliers/${supplierId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {supplierName ?? "supplier"}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Supplier Ledger</h1>
            <p className="text-sm text-muted-foreground">
              Every transaction, oldest first, with the running balance after each one. This is
              a read-only history — to record a new purchase or payment, use the buttons here or
              on the supplier&apos;s page.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" disabled={creatingPurchase} onClick={handleNewPurchase}>
              New purchase
            </Button>
            <RecordPaymentDialog supplierId={supplierId} />
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
