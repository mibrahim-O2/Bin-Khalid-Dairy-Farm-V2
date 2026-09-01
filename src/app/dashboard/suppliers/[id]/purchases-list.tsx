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
import {
  getPurchasePaymentStatus,
  type Purchase,
  type PurchasePaymentStatus,
  type PurchaseStatus,
} from "@/types/purchase";
import { createDraftPurchase } from "./purchases/actions";

const statusVariant: Record<PurchaseStatus, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  finalized: "default",
  void: "destructive",
};

// Matches DESIGN.md's financial status colors: Paid = success green,
// Partially Paid = warning gold-orange, Unpaid = neutral outline.
const paymentStatusClassName: Record<PurchasePaymentStatus, string> = {
  unpaid: "",
  partial: "border-transparent bg-warning text-warning-foreground",
  paid: "border-transparent bg-success text-success-foreground",
};

const paymentStatusLabel: Record<PurchasePaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partially Paid",
  paid: "Paid",
};

export function PurchasesList({ supplierId, purchases }: { supplierId: string; purchases: Purchase[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNewPurchase() {
    setCreating(true);
    setError(null);
    const result = await createDraftPurchase(supplierId);
    setCreating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/suppliers/${supplierId}/purchases/${result.purchaseId}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">Purchases</h2>
          <Button size="sm" disabled={creating} onClick={handleNewPurchase}>
            New purchase
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No purchases yet.
                  </TableCell>
                </TableRow>
              ) : (
                purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link
                        href={`/dashboard/suppliers/${supplierId}/purchases/${purchase.id}`}
                        className="hover:underline"
                      >
                        {formatDate(purchase.purchaseDate)}
                      </Link>
                    </TableCell>
                    <TableCell>{formatAmount(purchase.subtotal)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[purchase.status]} className="capitalize">
                        {purchase.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {purchase.status === "finalized" ? (
                        <Badge className={paymentStatusClassName[getPurchasePaymentStatus(purchase)]}>
                          {paymentStatusLabel[getPurchasePaymentStatus(purchase)]}
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
