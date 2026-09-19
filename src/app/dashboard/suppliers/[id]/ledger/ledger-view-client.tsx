"use client";

import { useState } from "react";
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
import type { Purchase } from "@/types/purchase";
import type { Supplier, SupplierLedgerTransaction } from "@/types/supplier";
import type { BusinessSettings, InvoiceSettings } from "@/types/settings";
import { ShareButtons } from "@/components/invoice/share-buttons";
import { SupplierStatementTemplate } from "@/components/invoice/supplier-statement-template";
import { DeletePaymentDialog } from "./delete-payment-dialog";
import { EditPaymentDialog } from "./edit-payment-dialog";
import { DeletePurchaseDialog } from "../purchases/[purchaseId]/delete-purchase-dialog";
import { RecordPaymentDialog } from "../record-payment-dialog";
import { generateSupplierStatement } from "../statements/actions";
import { createDraftPurchase } from "../purchases/actions";

export type LedgerRow = {
  transaction: SupplierLedgerTransaction; // createdAt already overridden to its effective date
  runningBalance: number;
  purchase?: Purchase;
  rawPayment?: { amount: number; method: string | null; note: string | null };
};

export type LedgerMonthGroup = {
  monthKey: string;
  monthLabel: string;
  monthStart: string;
  monthEnd: string;
  openingBalance: number;
  closingBalance: number;
  rows: LedgerRow[];
};

const typeLabels: Record<SupplierLedgerTransaction["type"], string> = {
  opening_balance: "Opening Balance",
  purchase: "Purchase",
  purchase_void: "Purchase Void",
  payment: "Payment",
  payment_void: "Payment Void",
};

function RowActions({
  supplierId,
  row,
  isOwner,
}: {
  supplierId: string;
  row: LedgerRow;
  isOwner: boolean;
}) {
  if (!isOwner) return null;
  const { transaction } = row;
  if (transaction.type === "purchase" && transaction.purchaseId) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={`/dashboard/suppliers/${supplierId}/purchases/${transaction.purchaseId}`}
          className="text-sm text-primary hover:underline"
        >
          Edit
        </Link>
        <DeletePurchaseDialog purchaseId={transaction.purchaseId} supplierId={supplierId} />
      </div>
    );
  }
  if (transaction.type === "payment" && transaction.paymentId && row.rawPayment) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <EditPaymentDialog
          paymentId={transaction.paymentId}
          amount={row.rawPayment.amount}
          method={row.rawPayment.method}
          note={row.rawPayment.note}
        />
        <DeletePaymentDialog paymentId={transaction.paymentId} />
      </div>
    );
  }
  return null;
}

function MonthSection({
  supplierId,
  supplier,
  group,
  businessInfo,
  invoiceSettings,
  isOwner,
}: {
  supplierId: string;
  supplier: Supplier;
  group: LedgerMonthGroup;
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateStatement() {
    setGenerating(true);
    setError(null);
    const result = await generateSupplierStatement({
      supplierId,
      startDate: group.monthStart,
      endDate: group.monthEnd,
    });
    setGenerating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/suppliers/${supplierId}/statements/${result.statementId}`);
  }

  const purchaseEntries = group.rows
    .filter((r) => r.transaction.type === "purchase" && r.purchase)
    .map((r) => ({ transaction: r.transaction, purchase: r.purchase! }));
  const otherEntries = group.rows
    .filter((r) => !(r.transaction.type === "purchase" && r.purchase))
    .map((r) => r.transaction);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">{group.monthLabel}</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={generating} onClick={handleGenerateStatement}>
              Generate Statement
            </Button>
            {/* "Save & Share on WhatsApp" — this app's existing two-action
                share widget (Save / Send via WhatsApp) applied to an
                ad-hoc statement built from this month's already-loaded
                rows, not a persisted record (Generate Statement above is
                the persisted-snapshot action). */}
            <ShareButtons
              fileName={`${supplier.name}-${group.monthKey}.png`}
              shareText={`Assalam-o-Alaikum, please find our account statement attached below for ${group.monthLabel}. Closing balance: Rs. ${formatAmount(group.closingBalance)}. Thank you — Bin Khalid Dairy Farm`}
            >
              <SupplierStatementTemplate
                statement={{
                  id: group.monthKey,
                  supplierId,
                  supplierName: supplier.name,
                  startDate: group.monthStart,
                  endDate: group.monthEnd,
                  openingBalance: group.openingBalance,
                  closingBalance: group.closingBalance,
                  transactions: [],
                  createdAt: new Date().toISOString(),
                  createdBy: { uid: "", email: null },
                }}
                purchaseEntries={purchaseEntries}
                otherEntries={otherEntries}
                businessInfo={businessInfo}
                invoiceSettings={invoiceSettings}
              />
            </ShareButtons>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {/* Desktop: real table. Mobile: one card per row — 11 columns
            can't fit a 390px screen. */}
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.rows.flatMap((row) => {
                const { transaction: entry, runningBalance, purchase } = row;
                const lines = purchase && purchase.lineItems.length > 0 ? purchase.lineItems : null;
                const rowCount = lines ? lines.length : 1;

                const dateCell = (
                  <TableCell key="date" className="align-top">
                    {formatDate(entry.createdAt)}
                  </TableCell>
                );
                const typeCell = (
                  <TableCell key="type" className="align-top font-medium text-foreground">
                    {typeLabels[entry.type]}
                  </TableCell>
                );
                const noteCell = (
                  <TableCell key="note" className="align-top text-muted-foreground">
                    {entry.note}
                  </TableCell>
                );
                const totalCell = (
                  <TableCell key="total" className="align-top">
                    {purchase ? formatAmount(purchase.subtotal) : "—"}
                  </TableCell>
                );
                const debitCell = (
                  <TableCell key="debit" className="align-top">
                    {entry.direction === "debit" ? formatAmount(entry.amount) : "—"}
                  </TableCell>
                );
                const creditCell = (
                  <TableCell key="credit" className="align-top">
                    {entry.direction === "credit" ? formatAmount(entry.amount) : "—"}
                  </TableCell>
                );
                const balanceCell = (
                  <TableCell key="balance" className="align-top font-medium text-foreground">
                    {formatAmount(runningBalance)}
                  </TableCell>
                );
                const actionsCell = (
                  <TableCell key="actions" className="align-top text-right">
                    <RowActions supplierId={supplierId} row={row} isOwner={isOwner} />
                  </TableCell>
                );

                if (!lines) {
                  return (
                    <TableRow key={entry.id}>
                      {dateCell}
                      {typeCell}
                      {noteCell}
                      <TableCell className="align-top text-muted-foreground">—</TableCell>
                      <TableCell className="align-top">—</TableCell>
                      <TableCell className="align-top">—</TableCell>
                      {totalCell}
                      {debitCell}
                      {creditCell}
                      {balanceCell}
                      {actionsCell}
                    </TableRow>
                  );
                }

                return lines.map((line, index) => (
                  <TableRow key={`${entry.id}-${line.itemId}-${index}`}>
                    {index === 0 ? (
                      <TableCell key="date" className="align-top" rowSpan={rowCount}>
                        {formatDate(entry.createdAt)}
                      </TableCell>
                    ) : null}
                    {index === 0 ? (
                      <TableCell key="type" className="align-top font-medium text-foreground" rowSpan={rowCount}>
                        {typeLabels[entry.type]}
                      </TableCell>
                    ) : null}
                    {index === 0 ? (
                      <TableCell key="note" className="align-top text-muted-foreground" rowSpan={rowCount}>
                        {entry.note}
                      </TableCell>
                    ) : null}
                    <TableCell className="align-top">
                      {line.itemName}
                      <span className="ml-1 text-xs text-muted-foreground">/{line.unit}</span>
                    </TableCell>
                    <TableCell className="align-top">{formatAmount(line.rate)}</TableCell>
                    <TableCell className="align-top">{line.quantity}</TableCell>
                    {index === 0 ? (
                      <TableCell className="align-top" rowSpan={rowCount}>
                        {formatAmount(purchase!.subtotal)}
                      </TableCell>
                    ) : null}
                    {index === 0 ? (
                      <TableCell className="align-top" rowSpan={rowCount}>
                        {entry.direction === "debit" ? formatAmount(entry.amount) : "—"}
                      </TableCell>
                    ) : null}
                    {index === 0 ? (
                      <TableCell className="align-top" rowSpan={rowCount}>
                        {entry.direction === "credit" ? formatAmount(entry.amount) : "—"}
                      </TableCell>
                    ) : null}
                    {index === 0 ? (
                      <TableCell className="align-top font-medium text-foreground" rowSpan={rowCount}>
                        {formatAmount(runningBalance)}
                      </TableCell>
                    ) : null}
                    {index === 0 ? (
                      <TableCell className="align-top text-right" rowSpan={rowCount}>
                        <RowActions supplierId={supplierId} row={row} isOwner={isOwner} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 md:hidden">
          {group.rows.map((row) => {
            const { transaction: entry, runningBalance, purchase } = row;
            return (
              <div key={entry.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{typeLabels[entry.type]}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(entry.createdAt)}</p>
                  </div>
                  <p className={entry.direction === "debit" ? "font-medium text-destructive" : "font-medium text-success"}>
                    {entry.direction === "debit" ? "− " : "+ "}
                    {formatAmount(entry.amount)}
                  </p>
                </div>
                {entry.note ? <p className="text-sm text-muted-foreground">{entry.note}</p> : null}
                {purchase && purchase.lineItems.length > 0 ? (
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {purchase.lineItems.map((line, index) => (
                      <div key={`${line.itemId}-${index}`}>
                        {line.itemName} <span className="text-xs">/{line.unit}</span> &times; {line.quantity} @ {formatAmount(line.rate)}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-medium text-foreground">{formatAmount(runningBalance)}</span>
                </div>
                <RowActions supplierId={supplierId} row={row} isOwner={isOwner} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function LedgerViewClient({
  supplierId,
  supplier,
  months,
  businessInfo,
  invoiceSettings,
  isOwner,
}: {
  supplierId: string;
  supplier: Supplier | null;
  months: LedgerMonthGroup[];
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
  isOwner: boolean;
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

  if (!supplier) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">Supplier not found.</p>
        <Link href="/dashboard/suppliers" className="text-sm text-primary hover:underline">
          Back to suppliers
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/suppliers/${supplierId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {supplier.name}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Supplier Ledger</h1>
            <p className="text-sm text-muted-foreground">
              Every transaction, grouped by month, with the running balance after each one and
              full item-level detail for every purchase.
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

      {months.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No transactions yet.
          </CardContent>
        </Card>
      ) : (
        // Newest month first — same convention as every other list in this app.
        [...months].reverse().map((group) => (
          <MonthSection
            key={group.monthKey}
            supplierId={supplierId}
            supplier={supplier}
            group={group}
            businessInfo={businessInfo}
            invoiceSettings={invoiceSettings}
            isOwner={isOwner}
          />
        ))
      )}
    </div>
  );
}
