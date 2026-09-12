import Image from "next/image";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import type { Purchase } from "@/types/purchase";
import type { Supplier } from "@/types/supplier";
import type { BusinessSettings, InvoiceSettings } from "@/types/settings";

const BRAND_GREEN = "#1B4332";

/**
 * A print/share-ready document for a single finalized purchase — mirrors
 * SupplierStatementTemplate's logo-led header/contact/thank-you treatment
 * for brand consistency. No Milk Calculation (not a milk product), no
 * payment-accounts section (an internal accounts-payable document, not
 * customer-facing). English-only, same as the supplier/employee
 * statements. Rendered off-screen and rasterized to a PNG by
 * WhatsAppShareButtons — never shown as part of the normal dashboard UI.
 */
export function PurchaseInvoiceTemplate({
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
          <p className="text-xs uppercase tracking-wide text-neutral-400">Supplier</p>
          <p className="mt-1 break-words text-base font-semibold leading-snug">{supplier.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Purchase</p>
          <p className="mt-1 text-neutral-500">{formatDate(purchase.purchaseDate)}</p>
        </div>
      </div>

      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[40%]" />
          <col className="w-[20%]" />
          <col className="w-[18%]" />
          <col className="w-[22%]" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-neutral-900 text-left">
            <th className="py-2 font-normal">Item</th>
            <th className="py-2 text-right font-normal">Rate</th>
            <th className="py-2 text-right font-normal">Quantity</th>
            <th className="py-2 text-right font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {purchase.lineItems.map((line, index) => (
            <tr key={`${line.itemId}-${index}`} className="border-b border-neutral-100 align-top">
              <td className="py-2 break-words">
                {line.itemName}
                <span className="ml-1 text-xs text-neutral-500">/{line.unit}</span>
              </td>
              <td className="py-2 text-right">{formatAmount(line.rate)}</td>
              <td className="py-2 text-right">{line.quantity}</td>
              <td className="py-2 text-right font-medium">{formatAmount(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col gap-1.5 self-end text-sm sm:w-72">
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">Subtotal</span>
          <span className="font-medium">{formatAmount(purchase.subtotal)}</span>
        </div>
        {purchase.previousBalance !== null ? (
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500">Previous balance</span>
            <span className="font-medium">{formatAmount(purchase.previousBalance)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-neutral-300 pt-1.5 text-base">
          <span className="font-medium">Total payable</span>
          <span className="font-bold">{formatAmount(purchase.totalPayable ?? purchase.subtotal)}</span>
        </div>
        <div className="flex justify-between gap-4 text-emerald-700">
          <span>Amount paid</span>
          <span className="font-medium">{formatAmount(purchase.amountPaid)}</span>
        </div>
      </div>

      {purchase.note ? <p className="text-sm text-neutral-600">{purchase.note}</p> : null}

      <p className="border-t border-neutral-200 pt-4 text-center text-sm font-medium" style={{ color: BRAND_GREEN }}>
        {invoiceSettings.footerNote || "Thank you for the continued partnership"}
      </p>
    </div>
  );
}
