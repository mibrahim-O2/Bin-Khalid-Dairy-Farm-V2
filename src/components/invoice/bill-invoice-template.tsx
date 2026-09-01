import Image from "next/image";
import { notoNastaliqUrdu } from "@/lib/fonts";
import { businessInfo } from "@/lib/business-info";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import type { Bill } from "@/types/bill";
import type { Customer } from "@/types/customer";

/**
 * A bilingual (English + Urdu) invoice for a finalized customer bill,
 * rendered as a fixed-width, print/share-ready document — deliberately
 * plain white/black regardless of the app's own theme, matching how a
 * printed or WhatsApp-shared receipt actually looks. Rendered off-screen
 * and rasterized to a PNG by ShareImageButton (src/components/invoice/
 * share-image-button.tsx); never shown as part of the normal dashboard UI.
 *
 * Bilingual scope, per DESIGN.md: static labels/headings are shown in both
 * languages (English above, Urdu below in Nastaliq/RTL) — the underlying
 * data (customer name, product names, notes) is whatever was actually
 * entered and isn't machine-translated.
 */
function Label({ en, ur }: { en: string; ur: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span>{en}</span>
      <span dir="rtl" className={`${notoNastaliqUrdu.className} text-[13px] text-neutral-500`}>
        {ur}
      </span>
    </span>
  );
}

export function BillInvoiceTemplate({ bill, customer }: { bill: Bill; customer: Customer }) {
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
          <Label en="Invoice" ur="رسید" />
          <p className="mt-1 font-mono text-lg font-bold">{bill.billNumber}</p>
        </div>
      </div>

      <div className="flex justify-between text-sm">
        <div>
          <Label en="Billed to" ur="بل موصول کنندہ" />
          <p className="mt-1 text-base font-semibold">{customer.name}</p>
          {customer.phone ? <p className="text-neutral-500">{customer.phone}</p> : null}
        </div>
        <div className="text-right">
          <Label en="Period" ur="مدت" />
          <p className="mt-1">
            {formatDate(bill.startDate)} – {formatDate(bill.endDate)}
          </p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-neutral-900 text-left">
            <th className="py-2 font-normal">
              <Label en="Product" ur="پروڈکٹ" />
            </th>
            <th className="py-2 text-right font-normal">
              <Label en="Rate" ur="ریٹ" />
            </th>
            <th className="py-2 text-right font-normal">
              <Label en="Quantity" ur="مقدار" />
            </th>
            <th className="py-2 text-right font-normal">
              <Label en="Amount" ur="رقم" />
            </th>
          </tr>
        </thead>
        <tbody>
          {bill.lineItems.map((line, index) => (
            <tr key={`${line.productId}-${index}`} className="border-b border-neutral-100">
              <td className="py-2">
                {line.productName}
                <span className="ml-1 text-xs text-neutral-500">/{line.unit}</span>
              </td>
              <td className="py-2 text-right">{formatAmount(line.rate)}</td>
              <td className="py-2 text-right">{line.totalQty}</td>
              <td className="py-2 text-right font-medium">{formatAmount(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col gap-1.5 self-end text-sm sm:w-64">
        <div className="flex justify-between">
          <Label en="Subtotal" ur="ذیلی رقم" />
          <span className="font-medium">{formatAmount(bill.subtotal)}</span>
        </div>
        {bill.previousBalance !== null ? (
          <div className="flex justify-between">
            <Label en="Previous balance" ur="گزشتہ بقایہ" />
            <span className="font-medium">{formatAmount(bill.previousBalance)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-neutral-300 pt-1.5 text-base">
          <Label en="Total payable" ur="کل ادائیگی" />
          <span className="font-bold">
            {formatAmount(bill.totalPayable ?? bill.subtotal)}
          </span>
        </div>
        <div className="flex justify-between text-emerald-700">
          <Label en="Amount paid" ur="ادا شدہ رقم" />
          <span className="font-medium">{formatAmount(bill.amountPaid)}</span>
        </div>
      </div>

      {bill.note ? <p className="border-t border-neutral-200 pt-4 text-sm text-neutral-600">{bill.note}</p> : null}

      <p className="border-t border-neutral-200 pt-4 text-center text-xs text-neutral-400">
        <span>Thank you for your business — </span>
        <span dir="rtl" className={notoNastaliqUrdu.className}>
          شکریہ
        </span>
      </p>
    </div>
  );
}
