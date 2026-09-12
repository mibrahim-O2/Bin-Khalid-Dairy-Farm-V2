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
import type { Purchase } from "@/types/purchase";
import type { Supplier } from "@/types/supplier";
import type { BusinessSettings, InvoiceSettings } from "@/types/settings";
import { WhatsAppShareButtons } from "@/components/invoice/whatsapp-share-buttons";
import { PurchaseInvoiceTemplate } from "@/components/invoice/purchase-invoice-template";
import { createDraftPurchase } from "./purchases/actions";

function SaveBillOrLink({
  purchase,
  supplier,
  supplierId,
  businessInfo,
  invoiceSettings,
}: {
  purchase: Purchase;
  supplier: Supplier;
  supplierId: string;
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
}) {
  if (purchase.status === "finalized") {
    return (
      <WhatsAppShareButtons
        fileName={`${supplier.name}-purchase-${purchase.purchaseDate}.png`}
        whatsappNumber={supplier.whatsappNumber ?? supplier.phone ?? null}
        whatsappMessage={`Assalam-o-Alaikum, please find the purchase document attached for ${formatDate(purchase.purchaseDate)}. Total payable: Rs. ${formatAmount(purchase.totalPayable ?? purchase.subtotal)}. Thank you — Bin Khalid Dairy Farm`}
      >
        <PurchaseInvoiceTemplate
          purchase={purchase}
          supplier={supplier}
          businessInfo={businessInfo}
          invoiceSettings={invoiceSettings}
        />
      </WhatsAppShareButtons>
    );
  }
  return (
    <Link href={`/dashboard/suppliers/${supplierId}/purchases/${purchase.id}`} className="text-sm text-primary hover:underline">
      {purchase.status === "draft" ? "Continue editing" : "View"}
    </Link>
  );
}

export function PurchasesList({
  supplierId,
  supplier,
  purchases,
  businessInfo,
  invoiceSettings,
}: {
  supplierId: string;
  supplier: Supplier;
  purchases: Purchase[];
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
}) {
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

        {/* Desktop: real table with items rowspan-ed under their purchase.
            Mobile: one card per purchase — 6 columns (one of them a
            multi-line item list) can't fit 390px without unreadable
            squeezing, so each purchase becomes its own card listing its
            items as simple rows instead of table cells. */}
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Save Bill</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No purchases yet.
                  </TableCell>
                </TableRow>
              ) : (
                purchases.flatMap((purchase) => {
                  const rowCount = Math.max(purchase.lineItems.length, 1);
                  const dateCell = (
                    <TableCell key="date" className="font-medium text-foreground align-top" rowSpan={rowCount}>
                      <Link
                        href={`/dashboard/suppliers/${supplierId}/purchases/${purchase.id}`}
                        className="hover:underline"
                      >
                        {formatDate(purchase.purchaseDate)}
                      </Link>
                      {purchase.status !== "finalized" ? (
                        <Badge
                          variant={purchase.status === "void" ? "destructive" : "secondary"}
                          className="ml-2 capitalize"
                        >
                          {purchase.status}
                        </Badge>
                      ) : null}
                    </TableCell>
                  );
                  const totalCell = (
                    <TableCell key="total" className="align-top" rowSpan={rowCount}>
                      {formatAmount(purchase.subtotal)}
                    </TableCell>
                  );
                  const actionCell = (
                    <TableCell key="action" className="align-top" rowSpan={rowCount}>
                      <SaveBillOrLink
                        purchase={purchase}
                        supplier={supplier}
                        supplierId={supplierId}
                        businessInfo={businessInfo}
                        invoiceSettings={invoiceSettings}
                      />
                    </TableCell>
                  );

                  if (purchase.lineItems.length === 0) {
                    return (
                      <TableRow key={purchase.id}>
                        {dateCell}
                        <TableCell className="text-muted-foreground">No items yet</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        {totalCell}
                        {actionCell}
                      </TableRow>
                    );
                  }

                  return purchase.lineItems.map((line, index) => (
                    <TableRow key={`${purchase.id}-${line.itemId}-${index}`}>
                      {index === 0 ? dateCell : null}
                      <TableCell>
                        {line.itemName}
                        <span className="ml-1 text-xs text-muted-foreground">/{line.unit}</span>
                      </TableCell>
                      <TableCell>{formatAmount(line.rate)}</TableCell>
                      <TableCell>{line.quantity}</TableCell>
                      {index === 0 ? totalCell : null}
                      {index === 0 ? actionCell : null}
                    </TableRow>
                  ));
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 md:hidden">
          {purchases.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No purchases yet.</p>
          ) : (
            purchases.map((purchase) => (
              <div key={purchase.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/suppliers/${supplierId}/purchases/${purchase.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {formatDate(purchase.purchaseDate)}
                  </Link>
                  {purchase.status !== "finalized" ? (
                    <Badge variant={purchase.status === "void" ? "destructive" : "secondary"} className="capitalize">
                      {purchase.status}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {purchase.lineItems.length === 0 ? (
                    <p>No items yet</p>
                  ) : (
                    purchase.lineItems.map((line, index) => (
                      <div key={`${line.itemId}-${index}`} className="flex justify-between gap-2">
                        <span>
                          {line.itemName} <span className="text-xs">/{line.unit}</span> &times; {line.quantity} @ {formatAmount(line.rate)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                  <span className="font-medium text-foreground">{formatAmount(purchase.subtotal)}</span>
                  <SaveBillOrLink
                    purchase={purchase}
                    supplier={supplier}
                    supplierId={supplierId}
                    businessInfo={businessInfo}
                    invoiceSettings={invoiceSettings}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
