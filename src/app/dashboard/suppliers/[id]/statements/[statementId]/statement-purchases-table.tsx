"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { Supplier, SupplierLedgerTransaction } from "@/types/supplier";
import type { BusinessSettings, InvoiceSettings } from "@/types/settings";
import { WhatsAppShareButtons } from "@/components/invoice/whatsapp-share-buttons";
import { PurchaseInvoiceTemplate } from "@/components/invoice/purchase-invoice-template";

function SaveBillButtons({
  purchase,
  supplier,
  businessInfo,
  invoiceSettings,
}: {
  purchase: Purchase;
  supplier: Supplier;
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
}) {
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

/**
 * The purchase side of a supplier statement, in the same Date | Item Name |
 * Rate | Quantity | Total Amount | Save Bill structure as PurchasesList —
 * each purchase keeps its own real "Save Bill" (WhatsApp + Save) button,
 * which only makes sense here because this is the live, interactive page.
 * The shareable statement *image* (SupplierStatementTemplate) can't hold a
 * button at all — it's a rasterized PNG — so it drops that column entirely
 * instead of showing a dead one.
 *
 * Desktop gets the real table; mobile gets one card per purchase (same
 * dual-layout pattern as PurchasesList/LivestockTable) since 6 columns,
 * one of them multi-line, can't fit a 390px screen.
 */
export function StatementPurchasesTable({
  supplierId,
  supplier,
  purchaseEntries,
  businessInfo,
  invoiceSettings,
}: {
  supplierId: string;
  supplier: Supplier;
  purchaseEntries: { transaction: SupplierLedgerTransaction; purchase: Purchase }[];
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchases in this period</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-0">
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
              {purchaseEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No purchases in this period.
                  </TableCell>
                </TableRow>
              ) : (
                purchaseEntries.flatMap(({ transaction, purchase }) => {
                  const rowCount = Math.max(purchase.lineItems.length, 1);
                  const dateCell = (
                    <TableCell key="date" className="font-medium text-foreground align-top" rowSpan={rowCount}>
                      <Link
                        href={`/dashboard/suppliers/${supplierId}/purchases/${purchase.id}`}
                        className="hover:underline"
                      >
                        {formatDate(transaction.createdAt)}
                      </Link>
                    </TableCell>
                  );
                  const totalCell = (
                    <TableCell key="total" className="align-top" rowSpan={rowCount}>
                      {formatAmount(purchase.subtotal)}
                    </TableCell>
                  );
                  const actionCell = (
                    <TableCell key="action" className="align-top" rowSpan={rowCount}>
                      <SaveBillButtons
                        purchase={purchase}
                        supplier={supplier}
                        businessInfo={businessInfo}
                        invoiceSettings={invoiceSettings}
                      />
                    </TableCell>
                  );

                  if (purchase.lineItems.length === 0) {
                    return (
                      <TableRow key={transaction.id}>
                        {dateCell}
                        <TableCell className="text-muted-foreground">No items</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        {totalCell}
                        {actionCell}
                      </TableRow>
                    );
                  }

                  return purchase.lineItems.map((line, index) => (
                    <TableRow key={`${transaction.id}-${line.itemId}-${index}`}>
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

        <div className="flex flex-col gap-3 px-4 pb-4 md:hidden">
          {purchaseEntries.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No purchases in this period.</p>
          ) : (
            purchaseEntries.map(({ transaction, purchase }) => (
              <div key={transaction.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <Link
                  href={`/dashboard/suppliers/${supplierId}/purchases/${purchase.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {formatDate(transaction.createdAt)}
                </Link>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {purchase.lineItems.length === 0 ? (
                    <p>No items</p>
                  ) : (
                    purchase.lineItems.map((line, index) => (
                      <div key={`${line.itemId}-${index}`}>
                        {line.itemName} <span className="text-xs">/{line.unit}</span> &times; {line.quantity} @ {formatAmount(line.rate)}
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                  <span className="font-medium text-foreground">{formatAmount(purchase.subtotal)}</span>
                  <SaveBillButtons
                    purchase={purchase}
                    supplier={supplier}
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
