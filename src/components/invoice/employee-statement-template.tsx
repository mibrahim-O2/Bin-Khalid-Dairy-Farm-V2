import Image from "next/image";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import type { EmployeeLedgerTransaction } from "@/types/employee";
import type { EmployeeStatement } from "@/types/employee-statement";
import type { BusinessSettings, InvoiceSettings } from "@/types/settings";

const BRAND_GREEN = "#1B4332";

const typeLabels: Record<EmployeeLedgerTransaction["type"], string> = {
  opening_balance: "Opening Balance",
  salary_accrual: "Salary Accrual",
  salary_accrual_void: "Salary Accrual Void",
  payment: "Payment",
  payment_void: "Payment Void",
};

/**
 * A print/share-ready statement for an employee's ledger over a date
 * range — mirrors SupplierStatementTemplate's logo-led header/contact/
 * thank-you treatment for brand consistency, with the same omissions: no
 * Milk Calculation and no payment-accounts section (an internal salary
 * statement, not a customer-facing bill). Domain C's reversed sign
 * convention is already baked into `statement.transactions` (credit =
 * salary accrued, debit = advance/payment taken) so the debit/credit
 * column logic here needs no special-casing.
 */
export function EmployeeStatementTemplate({
  statement,
  businessInfo,
  invoiceSettings,
}: {
  statement: EmployeeStatement;
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
}) {
  return (
    <div
      className="flex w-[720px] flex-col gap-6 bg-white p-10 text-neutral-900"
      style={{ fontFamily: "Manrope, Arial, sans-serif" }}
    >
      <div className="flex flex-col items-center gap-1 border-b border-neutral-200 pb-6 text-center">
        <Image
          src="/logoDairy.png"
          alt="Bin Khalid Dairy Farm"
          width={1254}
          height={1254}
          priority
          className="size-28 shrink-0 object-contain"
        />
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-xs text-neutral-500">
          {businessInfo.phone ? <span>{businessInfo.phone}</span> : null}
          {businessInfo.phone && businessInfo.address ? <span className="text-neutral-300">•</span> : null}
          {businessInfo.address ? <span>{businessInfo.address}</span> : null}
        </div>
        <p className="text-sm font-semibold italic" style={{ color: BRAND_GREEN }}>
          Pure Milk, Pure Life
        </p>
      </div>

      <div className="flex items-start justify-between gap-6 text-sm">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Employee</p>
          <p className="mt-1 break-words text-base font-semibold leading-snug">{statement.employeeName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Statement</p>
          <p className="mt-1 text-neutral-500">
            {formatDate(statement.startDate)} – {formatDate(statement.endDate)}
          </p>
        </div>
      </div>

      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[35%]" />
          <col className="w-[22%]" />
          <col className="w-[23%]" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-neutral-900 text-left">
            <th className="py-2 font-normal">Date</th>
            <th className="py-2 font-normal">Type</th>
            <th className="py-2 text-right font-normal">Debit</th>
            <th className="py-2 text-right font-normal">Credit</th>
          </tr>
        </thead>
        <tbody>
          {statement.transactions.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-center text-neutral-400">
                No transactions in this period.
              </td>
            </tr>
          ) : (
            statement.transactions.map((entry) => (
              <tr key={entry.id} className="border-b border-neutral-100 align-top">
                <td className="py-2">{formatDate(entry.createdAt)}</td>
                <td className="py-2 break-words">{typeLabels[entry.type]}</td>
                <td className="py-2 text-right">{entry.direction === "debit" ? formatAmount(entry.amount) : "—"}</td>
                <td className="py-2 text-right">{entry.direction === "credit" ? formatAmount(entry.amount) : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="flex flex-col gap-1.5 self-end text-sm sm:w-72">
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">Opening balance</span>
          <span className="font-medium">{formatAmount(statement.openingBalance)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-neutral-300 pt-1.5 text-base">
          <span className="font-medium">Closing balance</span>
          <span className="font-bold">{formatAmount(statement.closingBalance)}</span>
        </div>
      </div>

      <p className="border-t border-neutral-200 pt-4 text-center text-sm font-medium" style={{ color: BRAND_GREEN }}>
        {invoiceSettings.footerNote || "Thank you for being part of the Bin Khalid Dairy Farm team"}
      </p>
    </div>
  );
}
