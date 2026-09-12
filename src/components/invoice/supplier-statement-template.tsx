import Image from "next/image";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import type { SupplierLedgerTransaction } from "@/types/supplier";
import type { SupplierStatement } from "@/types/supplier-statement";
import type { Purchase } from "@/types/purchase";
import type { BusinessSettings, InvoiceSettings } from "@/types/settings";

const BRAND_GREEN = "#1B4332";

const typeLabels: Record<SupplierLedgerTransaction["type"], string> = {
  opening_balance: "Opening Balance",
  purchase: "Purchase",
  purchase_void: "Purchase Void",
  payment: "Payment",
  payment_void: "Payment Void",
};

/**
 * A print/share-ready statement for a supplier's ledger over a date range —
 * mirrors BillInvoiceTemplate's logo-led header/contact/thank-you treatment
 * for brand consistency, minus the parts that don't apply to an internal
 * accounts-payable document: no Milk Calculation (this isn't a product
 * bill) and no payment-accounts section (those are where a customer sends
 * money to the farm, not relevant to what the farm owes a supplier).
 * English-only throughout, per the redesigned bilingual scope — see
 * bill-invoice-template.tsx's doc comment.
 *
 * Purchases get itemized (Date/Item Name/Rate/Quantity/Total Amount) using
 * their own line items, same structure as the Purchases list — but with no
 * "Save Bill" column: this is a rasterized PNG, and a button can't exist
 * inside a static image. Everything else (payments, opening balance,
 * voided purchases) has no per-item shape to itemize, so it's listed
 * separately below in a plain Date/Type/Note/Debit/Credit table.
 */
export function SupplierStatementTemplate({
  statement,
  purchaseEntries,
  otherEntries,
  businessInfo,
  invoiceSettings,
}: {
  statement: SupplierStatement;
  purchaseEntries: { transaction: SupplierLedgerTransaction; purchase: Purchase }[];
  otherEntries: SupplierLedgerTransaction[];
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
          <p className="mt-1 break-words text-base font-semibold leading-snug">{statement.supplierName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Statement</p>
          <p className="mt-1 text-neutral-500">
            {formatDate(statement.startDate)} – {formatDate(statement.endDate)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Purchases</p>
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[34%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-neutral-900 text-left">
              <th className="py-2 font-normal">Date</th>
              <th className="py-2 font-normal">Item Name</th>
              <th className="py-2 text-right font-normal">Rate</th>
              <th className="py-2 text-right font-normal">Quantity</th>
              <th className="py-2 text-right font-normal">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {purchaseEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-neutral-400">
                  No purchases in this period.
                </td>
              </tr>
            ) : (
              purchaseEntries.flatMap(({ transaction, purchase }) => {
                const lines = purchase.lineItems.length > 0 ? purchase.lineItems : null;
                if (!lines) {
                  return (
                    <tr key={transaction.id} className="border-b border-neutral-100 align-top">
                      <td className="py-2">{formatDate(transaction.createdAt)}</td>
                      <td className="py-2 text-neutral-400">No items</td>
                      <td className="py-2 text-right">—</td>
                      <td className="py-2 text-right">—</td>
                      <td className="py-2 text-right font-medium">{formatAmount(purchase.subtotal)}</td>
                    </tr>
                  );
                }
                return lines.map((line, index) => (
                  <tr key={`${transaction.id}-${line.itemId}-${index}`} className="border-b border-neutral-100 align-top">
                    <td className="py-2">{index === 0 ? formatDate(transaction.createdAt) : ""}</td>
                    <td className="py-2 break-words">
                      {line.itemName}
                      <span className="ml-1 text-xs text-neutral-500">/{line.unit}</span>
                    </td>
                    <td className="py-2 text-right">{formatAmount(line.rate)}</td>
                    <td className="py-2 text-right">{line.quantity}</td>
                    <td className="py-2 text-right font-medium">
                      {index === 0 ? formatAmount(purchase.subtotal) : ""}
                    </td>
                  </tr>
                ));
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Payments &amp; other entries
        </p>
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
            {otherEntries.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-neutral-400">
                  None in this period.
                </td>
              </tr>
            ) : (
              otherEntries.map((entry) => (
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
      </div>

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
        {invoiceSettings.footerNote || "Thank you for the continued partnership"}
      </p>
    </div>
  );
}
