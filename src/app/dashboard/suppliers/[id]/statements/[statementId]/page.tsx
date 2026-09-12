import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { purchaseLineItems, purchases, suppliers, supplierStatements } from "@/lib/db/schema";
import { toPurchase, toSupplier, toSupplierStatement } from "@/lib/db/mappers";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SupplierLedgerTransaction } from "@/types/supplier";
import type { Purchase } from "@/types/purchase";
import { WhatsAppShareButtons } from "@/components/invoice/whatsapp-share-buttons";
import { SupplierStatementTemplate } from "@/components/invoice/supplier-statement-template";
import { getBusinessSettings, getInvoiceSettings } from "@/lib/db/settings";
import { StatementPurchasesTable } from "./statement-purchases-table";

const typeLabels: Record<SupplierLedgerTransaction["type"], string> = {
  opening_balance: "Opening Balance",
  purchase: "Purchase",
  purchase_void: "Purchase Void",
  payment: "Payment",
  payment_void: "Payment Void",
};

export default async function SupplierStatementPage({
  params,
}: {
  params: Promise<{ id: string; statementId: string }>;
}) {
  const { id: supplierId, statementId } = await params;
  const [row] = await getDb().select().from(supplierStatements).where(eq(supplierStatements.id, statementId));
  const statement = row ? toSupplierStatement(row) : null;
  const [supplierRow] = await getDb().select().from(suppliers).where(eq(suppliers.id, supplierId));
  const supplier = supplierRow ? toSupplier(supplierRow) : null;
  const [businessInfo, invoiceSettings] = await Promise.all([getBusinessSettings(), getInvoiceSettings()]);

  if (statement === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">Statement not found.</p>
        <Link href={`/dashboard/suppliers/${supplierId}`} className="text-sm text-primary hover:underline">
          Back to supplier
        </Link>
      </div>
    );
  }

  // "purchase" entries carry item/rate/quantity via their linked purchase
  // (looked up live, not from the frozen snapshot) so the statement can
  // list them in the same Date | Item Name | Rate | Quantity | Total
  // Amount structure as the Purchases list. This is safe because a
  // purchase's own line items are immutable once finalized — voiding
  // never mutates them, it only adds a separate purchase_void entry
  // (handled below via `otherEntries`, alongside payments/opening
  // balance, none of which have a per-item shape to itemize).
  const purchaseIds = statement.transactions
    .filter((entry) => entry.type === "purchase" && entry.purchaseId)
    .map((entry) => entry.purchaseId as string);
  const purchaseRows =
    purchaseIds.length > 0
      ? await getDb().select().from(purchases).where(inArray(purchases.id, purchaseIds))
      : [];
  const lineItemRows =
    purchaseIds.length > 0
      ? await getDb()
          .select()
          .from(purchaseLineItems)
          .where(inArray(purchaseLineItems.purchaseId, purchaseIds))
          .orderBy(purchaseLineItems.sortOrder)
      : [];
  const lineItemsByPurchaseId = new Map<string, typeof lineItemRows>();
  for (const line of lineItemRows) {
    const existing = lineItemsByPurchaseId.get(line.purchaseId) ?? [];
    existing.push(line);
    lineItemsByPurchaseId.set(line.purchaseId, existing);
  }
  const purchaseById = new Map<string, Purchase>(
    purchaseRows.map((r) => [r.id, toPurchase(r, lineItemsByPurchaseId.get(r.id) ?? [])])
  );

  const purchaseEntries: { transaction: SupplierLedgerTransaction; purchase: Purchase }[] = [];
  const otherEntries: SupplierLedgerTransaction[] = [];
  for (const entry of statement.transactions) {
    const purchase = entry.type === "purchase" && entry.purchaseId ? purchaseById.get(entry.purchaseId) : undefined;
    if (purchase) {
      purchaseEntries.push({ transaction: entry, purchase });
    } else {
      otherEntries.push(entry);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/dashboard/suppliers/${supplierId}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to {statement.supplierName}
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Statement — {formatDate(statement.startDate)} to {formatDate(statement.endDate)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Generated {formatDate(statement.createdAt)} for {statement.supplierName}
          </p>
        </div>
        <WhatsAppShareButtons
          fileName={`${statement.supplierName}-statement.png`}
          whatsappNumber={supplier?.whatsappNumber ?? supplier?.phone ?? null}
          whatsappMessage={`Assalam-o-Alaikum, please find our account statement attached below for ${formatDate(statement.startDate)} to ${formatDate(statement.endDate)}. Closing balance: Rs. ${formatAmount(statement.closingBalance)}. Thank you — Bin Khalid Dairy Farm`}
        >
          <SupplierStatementTemplate
            statement={statement}
            purchaseEntries={purchaseEntries}
            otherEntries={otherEntries}
            businessInfo={businessInfo}
            invoiceSettings={invoiceSettings}
          />
        </WhatsAppShareButtons>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Opening balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold text-foreground">
              {formatAmount(statement.openingBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Closing balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold text-foreground">
              {formatAmount(statement.closingBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {supplier ? (
        <StatementPurchasesTable
          supplierId={supplierId}
          supplier={supplier}
          purchaseEntries={purchaseEntries}
          businessInfo={businessInfo}
          invoiceSettings={invoiceSettings}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Other transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-0">
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No payments, opening balance, or void entries in this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  otherEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.createdAt)}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        {typeLabels[entry.type]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.note}</TableCell>
                      <TableCell>
                        {entry.direction === "debit" ? formatAmount(entry.amount) : "—"}
                      </TableCell>
                      <TableCell>
                        {entry.direction === "credit" ? formatAmount(entry.amount) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 px-4 pb-4 md:hidden">
            {otherEntries.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No payments, opening balance, or void entries in this period.
              </p>
            ) : (
              otherEntries.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{typeLabels[entry.type]}</span>
                    <span className="text-sm text-muted-foreground">{formatDate(entry.createdAt)}</span>
                  </div>
                  {entry.note ? <p className="text-sm text-muted-foreground">{entry.note}</p> : null}
                  <p className={entry.direction === "debit" ? "text-destructive" : "text-success"}>
                    {entry.direction === "debit" ? "− " : "+ "}
                    {formatAmount(entry.amount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
