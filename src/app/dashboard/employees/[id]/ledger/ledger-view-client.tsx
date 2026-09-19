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
import type { AuthorizedPerson, EmployeeLedgerTransaction } from "@/types/employee";
import type { EmployeeSalaryHistoryEntry } from "@/types/employee-salary";
import type { EmployeeSalaryAccrual } from "@/types/salary-accrual";
import type { EmployeePayment } from "@/types/employee-payment";
import type { BusinessSettings, InvoiceSettings } from "@/types/settings";
import { ShareButtons } from "@/components/invoice/share-buttons";
import { EmployeeStatementTemplate } from "@/components/invoice/employee-statement-template";
import { EditAccrualDialog } from "../edit-accrual-dialog";
import { DeleteAccrualDialog } from "../delete-accrual-dialog";
import { EditPaymentDialog } from "../edit-payment-dialog";
import { DeletePaymentDialog } from "../delete-payment-dialog";
import { RecordAccrualDialog } from "../record-accrual-dialog";
import { RecordPaymentDialog } from "../record-payment-dialog";
import { generateEmployeeStatement } from "../statements/actions";

export type LedgerRow = {
  transaction: EmployeeLedgerTransaction; // createdAt already overridden to its effective date
  runningBalance: number;
  accrual?: EmployeeSalaryAccrual;
  payment?: EmployeePayment;
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

const typeLabels: Record<EmployeeLedgerTransaction["type"], string> = {
  opening_balance: "Opening Balance",
  salary_accrual: "Salary Accrual",
  salary_accrual_void: "Salary Accrual Void",
  payment: "Payment",
  payment_void: "Payment Void",
};

function RowActions({
  row,
  authorizedPeople,
  isOwner,
}: {
  row: LedgerRow;
  authorizedPeople: AuthorizedPerson[];
  isOwner: boolean;
}) {
  const { transaction } = row;
  // Edit is available to any active admin; only Delete is Owner-only —
  // deliberately looser than the Supplier/Customer ledgers, matching this
  // module's pre-existing trust level (recording/voiding an accrual or
  // payment was never Owner-gated here either).
  if (transaction.type === "salary_accrual" && row.accrual) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <EditAccrualDialog accrual={row.accrual} />
        {isOwner ? <DeleteAccrualDialog accrualId={row.accrual.id} /> : null}
      </div>
    );
  }
  if (transaction.type === "payment" && row.payment) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <EditPaymentDialog payment={row.payment} authorizedPeople={authorizedPeople} />
        {isOwner ? <DeletePaymentDialog paymentId={row.payment.id} /> : null}
      </div>
    );
  }
  return null;
}

function MonthSection({
  employeeId,
  employeeName,
  employeeWhatsappNumber,
  employeePhone,
  group,
  businessInfo,
  invoiceSettings,
  authorizedPeople,
  isOwner,
}: {
  employeeId: string;
  employeeName: string;
  employeeWhatsappNumber: string | null;
  employeePhone: string | null;
  group: LedgerMonthGroup;
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
  authorizedPeople: AuthorizedPerson[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateStatement() {
    setGenerating(true);
    setError(null);
    const result = await generateEmployeeStatement({
      employeeId,
      startDate: group.monthStart,
      endDate: group.monthEnd,
    });
    setGenerating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/employees/${employeeId}/statements/${result.statementId}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">{group.monthLabel}</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={generating} onClick={handleGenerateStatement}>
              Generate Statement
            </Button>
            {/* Ad-hoc statement built from this month's already-loaded
                rows, not a persisted record (Generate Statement above is
                the persisted-snapshot action) — same pattern as the
                Supplier/Customer ledgers' per-month share buttons. */}
            <ShareButtons
              fileName={`${employeeName}-${group.monthKey}.png`}
              shareText={`Assalam-o-Alaikum ${employeeName}, please find your salary statement attached below for ${group.monthLabel}. Closing balance: Rs. ${formatAmount(group.closingBalance)}. — Bin Khalid Dairy Farm`}
            >
              <EmployeeStatementTemplate
                statement={{
                  id: group.monthKey,
                  employeeId,
                  employeeName,
                  startDate: group.monthStart,
                  endDate: group.monthEnd,
                  openingBalance: group.openingBalance,
                  closingBalance: group.closingBalance,
                  transactions: group.rows.map((r) => r.transaction),
                  createdAt: new Date().toISOString(),
                  createdBy: { uid: "", email: null },
                }}
                businessInfo={businessInfo}
                invoiceSettings={invoiceSettings}
              />
            </ShareButtons>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {/* Desktop: real table. Mobile: one card per row. */}
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Leave</TableHead>
                <TableHead>Leave Amount</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.rows.map((row) => {
                const { transaction: entry, runningBalance } = row;
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="align-top">{formatDate(entry.createdAt)}</TableCell>
                    <TableCell className="align-top font-medium text-foreground">{typeLabels[entry.type]}</TableCell>
                    <TableCell className="align-top text-muted-foreground">{entry.note}</TableCell>
                    <TableCell className="align-top">{formatAmount(entry.amount)}</TableCell>
                    <TableCell className="align-top">
                      {entry.leaveDaysDeducted ? entry.leaveDaysDeducted : "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      {entry.leaveAmountDeducted ? formatAmount(entry.leaveAmountDeducted) : "—"}
                    </TableCell>
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
                      <RowActions row={row} authorizedPeople={authorizedPeople} isOwner={isOwner} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 md:hidden">
          {group.rows.map((row) => {
            const { transaction: entry, runningBalance } = row;
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
                {entry.leaveDaysDeducted ? (
                  <p className="text-sm text-muted-foreground">
                    Leave: {entry.leaveDaysDeducted} day{entry.leaveDaysDeducted === 1 ? "" : "s"}, deducted{" "}
                    {formatAmount(entry.leaveAmountDeducted ?? 0)}
                  </p>
                ) : null}
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-medium text-foreground">{formatAmount(runningBalance)}</span>
                </div>
                <RowActions row={row} authorizedPeople={authorizedPeople} isOwner={isOwner} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function LedgerViewClient({
  employeeId,
  employeeName,
  employeeWhatsappNumber,
  employeePhone,
  months,
  salaryHistory,
  authorizedPeople,
  businessInfo,
  invoiceSettings,
  isOwner,
}: {
  employeeId: string;
  employeeName: string | null;
  employeeWhatsappNumber: string | null;
  employeePhone: string | null;
  months: LedgerMonthGroup[];
  salaryHistory: EmployeeSalaryHistoryEntry[];
  authorizedPeople: AuthorizedPerson[];
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
  isOwner: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/employees/${employeeId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {employeeName ?? "employee"}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Employee Ledger</h1>
            <p className="text-sm text-muted-foreground">
              Every transaction, grouped by month, with the running balance after each one.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <RecordAccrualDialog employeeId={employeeId} salaryHistory={salaryHistory} />
            <RecordPaymentDialog employeeId={employeeId} authorizedPeople={authorizedPeople} />
          </div>
        </div>
      </div>

      {months.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">No transactions yet.</CardContent>
        </Card>
      ) : (
        // Newest month first — same convention as every other list in this app.
        [...months].reverse().map((group) => (
          <MonthSection
            key={group.monthKey}
            employeeId={employeeId}
            employeeName={employeeName ?? "Employee"}
            employeeWhatsappNumber={employeeWhatsappNumber}
            employeePhone={employeePhone}
            group={group}
            businessInfo={businessInfo}
            invoiceSettings={invoiceSettings}
            authorizedPeople={authorizedPeople}
            isOwner={isOwner}
          />
        ))
      )}
    </div>
  );
}
