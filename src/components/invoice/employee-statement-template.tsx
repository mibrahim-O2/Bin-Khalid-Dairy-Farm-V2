import Image from "next/image";
import { notoNastaliqUrdu } from "@/lib/fonts";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import type { EmployeeLedgerTransaction } from "@/types/employee";
import type { EmployeeStatement } from "@/types/employee-statement";
import type { BusinessSettings, InvoiceSettings } from "@/types/settings";
import { BilingualLabel as Label } from "./bilingual-label";

const typeLabels: Record<EmployeeLedgerTransaction["type"], { en: string; ur: string }> = {
  opening_balance: { en: "Opening Balance", ur: "ابتدائی بیلنس" },
  salary_accrual: { en: "Salary Accrual", ur: "تنخواہ جمع" },
  salary_accrual_void: { en: "Salary Accrual Void", ur: "تنخواہ جمع منسوخ" },
  payment: { en: "Payment", ur: "ادائیگی" },
  payment_void: { en: "Payment Void", ur: "ادائیگی منسوخ" },
};

/**
 * A bilingual (English + Urdu) statement for an employee's ledger over a
 * date range — mirrors SupplierStatementTemplate exactly, with Domain C's
 * reversed sign convention already baked into `statement.transactions`
 * (credit = salary accrued, debit = advance/payment taken) so the display
 * logic here (debit column vs credit column) needs no special-casing.
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
      <div className="flex items-start justify-between border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logoDairy.png"
            alt="Bin Khalid Dairy Farm"
            width={1254}
            height={1254}
            className="size-14 shrink-0 object-contain"
          />
          <div>
            <p className="text-xl font-bold">{businessInfo.name}</p>
            <p dir="rtl" className={`${notoNastaliqUrdu.className} text-base text-neutral-600`}>
              {businessInfo.nameUrdu}
            </p>
            {businessInfo.phone ? <p className="mt-1 text-xs text-neutral-500">{businessInfo.phone}</p> : null}
            {businessInfo.address ? <p className="text-xs text-neutral-500">{businessInfo.address}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <Label en="Statement" ur="کھاتہ" />
        </div>
      </div>

      <div className="flex justify-between text-sm">
        <div>
          <Label en="Employee" ur="ملازم" />
          <p className="mt-1 text-base font-semibold">{statement.employeeName}</p>
        </div>
        <div className="text-right">
          <Label en="Period" ur="مدت" />
          <p className="mt-1">
            {formatDate(statement.startDate)} – {formatDate(statement.endDate)}
          </p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-neutral-900 text-left">
            <th className="py-2 font-normal">
              <Label en="Date" ur="تاریخ" />
            </th>
            <th className="py-2 font-normal">
              <Label en="Type" ur="قسم" />
            </th>
            <th className="py-2 text-right font-normal">
              <Label en="Debit" ur="ڈیبٹ" />
            </th>
            <th className="py-2 text-right font-normal">
              <Label en="Credit" ur="کریڈٹ" />
            </th>
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
              <tr key={entry.id} className="border-b border-neutral-100">
                <td className="py-2">{formatDate(entry.createdAt)}</td>
                <td className="py-2">
                  {typeLabels[entry.type].en}
                  <span className="ml-1 text-xs text-neutral-500">/ {typeLabels[entry.type].ur}</span>
                </td>
                <td className="py-2 text-right">{entry.direction === "debit" ? formatAmount(entry.amount) : "—"}</td>
                <td className="py-2 text-right">{entry.direction === "credit" ? formatAmount(entry.amount) : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="flex flex-col gap-1.5 self-end text-sm sm:w-64">
        <div className="flex justify-between">
          <Label en="Opening balance" ur="ابتدائی بیلنس" />
          <span className="font-medium">{formatAmount(statement.openingBalance)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-300 pt-1.5 text-base">
          <Label en="Closing balance" ur="اختتامی بیلنس" />
          <span className="font-bold">{formatAmount(statement.closingBalance)}</span>
        </div>
      </div>

      <p className="border-t border-neutral-200 pt-4 text-center text-xs text-neutral-400">
        {invoiceSettings.footerNote ? (
          <span>{invoiceSettings.footerNote}</span>
        ) : (
          <span>Thank you for your business — </span>
        )}
        <span dir="rtl" className={notoNastaliqUrdu.className}>
          {invoiceSettings.footerNoteUrdu ?? "شکریہ"}
        </span>
      </p>
    </div>
  );
}
