"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { getBillPaymentStatus, type Bill, type BillPaymentStatus, type BillStatus } from "@/types/bill";
import { createDraftBill } from "./bills/actions";

const statusVariant: Record<BillStatus, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  finalized: "default",
  void: "destructive",
};

// Matches DESIGN.md's financial status colors: Paid = success green,
// Partially Paid = warning gold-orange, Unpaid = neutral outline.
const paymentStatusClassName: Record<BillPaymentStatus, string> = {
  unpaid: "",
  partial: "border-transparent bg-warning text-warning-foreground",
  paid: "border-transparent bg-success text-success-foreground",
};

const paymentStatusLabel: Record<BillPaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partially Paid",
  paid: "Paid",
};

export function BillsList({ customerId, bills }: { customerId: string; bills: Bill[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNewBill() {
    setCreating(true);
    setError(null);
    const result = await createDraftBill(customerId);
    setCreating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/customers/${customerId}/bills/${result.billId}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">Bills</h2>
          <Button size="sm" disabled={creating} onClick={handleNewBill}>
            New bill
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No bills yet.
                  </TableCell>
                </TableRow>
              ) : (
                bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link
                        href={`/dashboard/customers/${customerId}/bills/${bill.id}`}
                        className="hover:underline"
                      >
                        {bill.billNumber ?? "Draft"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatDate(bill.startDate)} – {formatDate(bill.endDate)}
                    </TableCell>
                    <TableCell>{formatAmount(bill.subtotal)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[bill.status]} className="capitalize">
                        {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {bill.status === "finalized" ? (
                        <Badge className={paymentStatusClassName[getBillPaymentStatus(bill)]}>
                          {paymentStatusLabel[getBillPaymentStatus(bill)]}
                        </Badge>
                      ) : (
                        "—"
                      )}
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
