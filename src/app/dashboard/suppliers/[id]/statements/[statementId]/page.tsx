import { eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { supplierStatements } from "@/lib/db/schema";
import { toSupplierStatement } from "@/lib/db/mappers";
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
import { ShareImageButton } from "@/components/invoice/share-image-button";
import { SupplierStatementTemplate } from "@/components/invoice/supplier-statement-template";
import { getBusinessSettings, getInvoiceSettings } from "@/lib/db/settings";

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
        <ShareImageButton
          fileName={`${statement.supplierName}-statement.png`}
          shareTitle={`Statement — ${statement.supplierName}`}
          shareText={`${formatDate(statement.startDate)} to ${formatDate(statement.endDate)}`}
        >
          <SupplierStatementTemplate statement={statement} businessInfo={businessInfo} invoiceSettings={invoiceSettings} />
        </ShareImageButton>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No transactions in this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  statement.transactions.map((entry) => (
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
        </CardContent>
      </Card>
    </div>
  );
}
