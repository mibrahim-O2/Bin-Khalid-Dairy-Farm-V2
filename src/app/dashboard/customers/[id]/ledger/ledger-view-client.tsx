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
import type { Bill } from "@/types/bill";
import type { Customer, CustomerLedgerTransaction } from "@/types/customer";
import type { BusinessSettings, InvoiceSettings } from "@/types/settings";
import { WhatsAppShareButtons } from "@/components/invoice/whatsapp-share-buttons";
import { CustomerStatementTemplate } from "@/components/invoice/customer-statement-template";
import { DeletePaymentDialog } from "./delete-payment-dialog";
import { EditPaymentDialog } from "./edit-payment-dialog";
import { DeleteBillDialog } from "../bills/[billId]/delete-bill-dialog";
import { RecordPaymentDialog } from "../record-payment-dialog";
import { createDraftBill } from "../bills/actions";

export type LedgerRow = {
  transaction: CustomerLedgerTransaction; // createdAt already overridden to its effective date
  runningBalance: number;
  bill?: Bill;
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

const typeLabels: Record<CustomerLedgerTransaction["type"], string> = {
  opening_balance: "Opening Balance",
  bill: "Bill",
  bill_void: "Bill Void",
  payment: "Payment",
  payment_void: "Payment Void",
};

function RowActions({
  customerId,
  row,
  isOwner,
}: {
  customerId: string;
  row: LedgerRow;
  isOwner: boolean;
}) {
  if (!isOwner) return null;
  const { transaction } = row;
  if (transaction.type === "bill" && transaction.billId) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={`/dashboard/customers/${customerId}/bills/${transaction.billId}`}
          className="text-sm text-primary hover:underline"
        >
          Edit
        </Link>
        <DeleteBillDialog billId={transaction.billId} customerId={customerId} />
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
  customerId,
  customer,
  group,
  businessInfo,
  invoiceSettings,
  isOwner,
}: {
  customerId: string;
  customer: Customer;
  group: LedgerMonthGroup;
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
  isOwner: boolean;
}) {
  const billEntries = group.rows
    .filter((r) => r.transaction.type === "bill" && r.bill)
    .map((r) => ({ transaction: r.transaction, bill: r.bill! }));
  const otherEntries = group.rows
    .filter((r) => !(r.transaction.type === "bill" && r.bill))
    .map((r) => r.transaction);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">{group.monthLabel}</h2>
          {/* "Save Bill" / "Share on WhatsApp" — this app's existing
              two-action share widget (Save / Send via WhatsApp), relabeled
              for this context, wrapping an ad-hoc monthly statement built
              from this month's already-loaded rows. Customers don't have
              a persisted "statement" concept the way suppliers do (bills
              themselves are the shareable per-transaction document), so
              there's no separate "generate" action here — just save/share. */}
          <WhatsAppShareButtons
            fileName={`${customer.name}-${group.monthKey}.png`}
            whatsappNumber={customer.whatsappNumber ?? customer.phone ?? null}
            whatsappMessage={`Assalam-o-Alaikum ${customer.name}, please find your account statement attached below for ${group.monthLabel}. Closing balance: Rs. ${formatAmount(group.closingBalance)}. Thank you — Bin Khalid Dairy Farm`}
            saveLabel="Save Bill"
            whatsappLabel="Share on WhatsApp"
          >
            <CustomerStatementTemplate
              customerName={customer.name}
              startDate={group.monthStart}
              endDate={group.monthEnd}
              openingBalance={group.openingBalance}
              closingBalance={group.closingBalance}
              billEntries={billEntries}
              otherEntries={otherEntries}
              businessInfo={businessInfo}
              invoiceSettings={invoiceSettings}
            />
          </WhatsAppShareButtons>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Product Name</TableHead>
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
                const { transaction: entry, runningBalance, bill } = row;
                const lines = bill && bill.lineItems.length > 0 ? bill.lineItems : null;
                const rowCount = lines ? lines.length : 1;

                if (!lines) {
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="align-top">{formatDate(entry.createdAt)}</TableCell>
                      <TableCell className="align-top font-medium text-foreground">{typeLabels[entry.type]}</TableCell>
                      <TableCell className="align-top text-muted-foreground">{entry.note}</TableCell>
                      <TableCell className="align-top text-muted-foreground">—</TableCell>
                      <TableCell className="align-top">—</TableCell>
                      <TableCell className="align-top">—</TableCell>
                      <TableCell className="align-top">{bill ? formatAmount(bill.subtotal) : "—"}</TableCell>
                      <TableCell className="align-top">
                        {entry.direction === "debit" ? formatAmount(entry.amount) : "—"}
                      </TableCell>
                      <TableCell className="align-top">
                        {entry.direction === "credit" ? formatAmount(entry.amount) : "—"}
                      </TableCell>
                      <TableCell className="align-top font-medium text-foreground">
                        {formatAmount(runningBalance)}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <RowActions customerId={customerId} row={row} isOwner={isOwner} />
                      </TableCell>
                    </TableRow>
                  );
                }

                return lines.map((line, index) => (
                  <TableRow key={`${entry.id}-${line.productId}-${index}`}>
                    {index === 0 ? (
                      <TableCell className="align-top" rowSpan={rowCount}>
                        {formatDate(entry.createdAt)}
                      </TableCell>
                    ) : null}
                    {index === 0 ? (
                      <TableCell className="align-top font-medium text-foreground" rowSpan={rowCount}>
                        {typeLabels[entry.type]}
                      </TableCell>
                    ) : null}
                    {index === 0 ? (
                      <TableCell className="align-top text-muted-foreground" rowSpan={rowCount}>
                        {entry.note}
                      </TableCell>
                    ) : null}
                    <TableCell className="align-top">
                      {line.productName}
                      <span className="ml-1 text-xs text-muted-foreground">/{line.unit}</span>
                    </TableCell>
                    <TableCell className="align-top">{formatAmount(line.rate)}</TableCell>
                    <TableCell className="align-top">{line.totalQty}</TableCell>
                    {index === 0 ? (
                      <TableCell className="align-top" rowSpan={rowCount}>
                        {formatAmount(bill!.subtotal)}
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
                        <RowActions customerId={customerId} row={row} isOwner={isOwner} />
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
            const { transaction: entry, runningBalance, bill } = row;
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
                {bill && bill.lineItems.length > 0 ? (
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {bill.lineItems.map((line, index) => (
                      <div key={`${line.productId}-${index}`}>
                        {line.productName} <span className="text-xs">/{line.unit}</span> &times; {line.totalQty} @ {formatAmount(line.rate)}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-medium text-foreground">{formatAmount(runningBalance)}</span>
                </div>
                <RowActions customerId={customerId} row={row} isOwner={isOwner} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function LedgerViewClient({
  customerId,
  customer,
  months,
  businessInfo,
  invoiceSettings,
  isOwner,
}: {
  customerId: string;
  customer: Customer | null;
  months: LedgerMonthGroup[];
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
  isOwner: boolean;
}) {
  const router = useRouter();
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

  if (!customer) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">Customer not found.</p>
        <Link href="/dashboard/customers" className="text-sm text-primary hover:underline">
          Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/customers/${customerId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {customer.name}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Customer Ledger</h1>
            <p className="text-sm text-muted-foreground">
              Every transaction, grouped by month, with the running balance after each one and
              full item-level detail for every bill.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" disabled={creatingBill} onClick={handleNewBill}>
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

      {months.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No transactions yet.
          </CardContent>
        </Card>
      ) : (
        [...months].reverse().map((group) => (
          <MonthSection
            key={group.monthKey}
            customerId={customerId}
            customer={customer}
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
