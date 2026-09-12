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

/**
 * The purchase side of a supplier statement, in the same Date | Item Name |
 * Rate | Quantity | Total Amount | Save Bill structure as PurchasesList —
 * each purchase keeps its own real "Save Bill" (WhatsApp + Save) button,
 * which only makes sense here because this is the live, interactive page.
 * The shareable statement *image* (SupplierStatementTemplate) can't hold a
 * button at all — it's a rasterized PNG — so it drops that column entirely
 * instead of showing a dead one.
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
      <CardContent className="p-0">
        <div className="overflow-x-auto">
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
      </CardContent>
    </Card>
  );
}
