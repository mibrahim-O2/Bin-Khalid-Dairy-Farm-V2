import Image from "next/image";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import type { Bill } from "@/types/bill";
import type { Customer } from "@/types/customer";
import type { BusinessSettings, InvoiceSettings, PaymentAccount, PaymentSettings } from "@/types/settings";
import { BilingualLabel as Label } from "./bilingual-label";

const BRAND_GREEN = "#1B4332";

/**
 * Two Settings-configured accounts (e.g. Easypaisa and JazzCash) often
 * share the same physical mobile number — showing that number twice under
 * two separate labels reads as a mistake, not two real options. Groups by
 * accountNumber and joins the labels that share one with " / ", in
 * first-seen order.
 */
function mergeAccountsBySharedNumber(accounts: PaymentAccount[]): { label: string; accountNumber: string }[] {
  const labelsByNumber = new Map<string, string[]>();
  for (const account of accounts) {
    const labels = labelsByNumber.get(account.accountNumber) ?? [];
    labels.push(account.label);
    labelsByNumber.set(account.accountNumber, labels);
  }
  return Array.from(labelsByNumber.entries()).map(([accountNumber, labels]) => ({
    accountNumber,
    label: labels.join(" / "),
  }));
}

/**
 * A print/share-ready invoice for a finalized customer bill, rendered
 * off-screen and rasterized to a PNG by ShareImageButton (src/components/
 * invoice/share-image-button.tsx) — deliberately plain white/black
 * regardless of the app's own theme, matching how a printed or
 * WhatsApp-shared receipt actually looks. Never shown as part of the
 * normal dashboard UI.
 *
 * Bilingual scope (redesigned): the logo art already spells out the farm
 * name, so the header carries no duplicate name text at all. Everywhere
 * else on the document is English-only — the Milk Calculation section is
 * the ONE bilingual section left, because it's the part a customer is most
 * likely to want explained in Urdu.
 *
 * businessInfo/paymentSettings/invoiceSettings come from the Settings
 * module (Phase 9, src/lib/db/settings.ts) — always fetched fresh by the
 * calling page/Server Action and passed down, never imported as a static
 * constant here, so an edit in Settings shows up on the very next share.
 */
export function BillInvoiceTemplate({
  bill,
  customer,
  businessInfo,
  paymentSettings,
  invoiceSettings,
}: {
  bill: Bill;
  customer: Customer;
  businessInfo: BusinessSettings;
  paymentSettings: PaymentSettings;
  invoiceSettings: InvoiceSettings;
}) {
  const milkLines = bill.lineItems.filter((line) => line.billingType === "milk");
  const otherLines = bill.lineItems.filter((line) => line.billingType !== "milk");
  const mergedAccounts = mergeAccountsBySharedNumber(paymentSettings.accounts);

  return (
    <div
      className="flex w-[720px] flex-col gap-6 bg-white p-10 text-neutral-900"
      style={{ fontFamily: "Manrope, Arial, sans-serif" }}
    >
      {/* Logo-led header — the logo art already spells out the farm name, so
          no plain-text name is duplicated next to it. */}
      <div className="flex flex-col items-center gap-1 border-b border-neutral-200 pb-6 text-center">
        <Image
          src="/logoDairy.png"
          alt="Bin Khalid Dairy Farm"
          width={1254}
          height={1254}
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
          <p className="text-xs uppercase tracking-wide text-neutral-400">Billed to</p>
          <p className="mt-1 break-words text-base font-semibold leading-snug">{customer.name}</p>
          {customer.phone ? <p className="text-neutral-500">{customer.phone}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Invoice</p>
          <p className="mt-1 font-mono text-lg font-bold">{bill.billNumber}</p>
          <p className="mt-1 text-neutral-500">
            {formatDate(bill.startDate)} – {formatDate(bill.endDate)}
          </p>
        </div>
      </div>

      {milkLines.length > 0 ? (
        <div
          className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4"
          style={{ backgroundColor: "rgba(27, 67, 50, 0.04)" }}
        >
          <Label en="Milk Calculation" ur="دودھ کا حساب" />
          {milkLines.map((line) => (
            <table key={line.productId} className="w-full text-sm">
              {milkLines.length > 1 ? (
                <caption className="mb-1 text-left text-xs font-medium text-neutral-500">
                  {line.productName}
                </caption>
              ) : null}
              <tbody>
                <tr className="border-b border-neutral-200/70">
                  <td className="py-1.5">
                    <Label en="Billing Period" ur="مدت بلنگ" />
                  </td>
                  <td className="py-1.5 text-right font-medium">{bill.days} days</td>
                </tr>
                <tr className="border-b border-neutral-200/70">
                  <td className="py-1.5">
                    <Label en="Rate per KG" ur="فی کلو ریٹ" />
                  </td>
                  <td className="py-1.5 text-right font-medium">{formatAmount(line.rate)}</td>
                </tr>
                <tr className="border-b border-neutral-200/70">
                  <td className="py-1.5">
                    <Label en="Daily Milk" ur="یومیہ دودھ" />
                  </td>
                  <td className="py-1.5 text-right font-medium">
                    {line.dailyQty ?? 0} {line.unit}
                  </td>
                </tr>
                <tr className="border-b border-neutral-200/70">
                  <td className="py-1.5">
                    <Label en="Extra Milk Added" ur="اضافی دودھ" />
                  </td>
                  <td className="py-1.5 text-right font-medium">
                    {line.extra ?? 0} {line.unit}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5">
                    <Label en="Milk Deducted" ur="کم شدہ دودھ" />
                  </td>
                  <td className="py-1.5 text-right font-medium">
                    {line.less ?? 0} {line.unit}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="pt-2">
                    <div
                      className="flex items-center justify-between rounded-sm px-3 py-2"
                      style={{ backgroundColor: "rgba(27, 67, 50, 0.1)" }}
                    >
                      <Label en="Total Milk" ur="کل دودھ" />
                      <span className="text-base font-bold" style={{ color: BRAND_GREEN }}>
                        {line.totalQty} {line.unit}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          ))}
        </div>
      ) : null}

      {/* Non-milk items (e.g. Ghee, Makhan, Dahi) — a simple name/qty/amount
          list, not the full table: their rate is already implied by the
          amount, and repeating the table headers here for what's often a
          single extra line would outweigh the information it carries. */}
      {otherLines.length > 0 ? (
        <div className="flex flex-col gap-1.5 text-sm">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Items</p>
          {otherLines.map((line, index) => (
            <div key={`${line.productId}-${index}`} className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 break-words">
                {line.productName}
                <span className="ml-1 text-xs text-neutral-500">
                  — {line.totalQty} {line.unit}
                </span>
              </span>
              <span className="shrink-0 font-medium">{formatAmount(line.lineTotal)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {bill.note ? <p className="text-sm text-neutral-600">{bill.note}</p> : null}

      {/* Payment accounts (left) / totals block (right) share one row. */}
      <div className="flex items-start justify-between gap-6 border-t border-neutral-200 pt-4 text-sm">
        <div className="min-w-0 flex-1">
          {mergedAccounts.length > 0 ? (
            <>
              <p className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Payment accounts</p>
              <div className="flex flex-col gap-1">
                {mergedAccounts.map((account) => (
                  <p key={account.accountNumber}>
                    <span className="text-neutral-500">{account.label}: </span>
                    <span className="font-medium">{account.accountNumber}</span>
                  </p>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:w-72">
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500">Subtotal</span>
            <span className="font-medium">{formatAmount(bill.subtotal)}</span>
          </div>
          {bill.previousBalance !== null ? (
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Previous balance</span>
              <span className="font-medium">{formatAmount(bill.previousBalance)}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-neutral-300 pt-1.5 text-base">
            <span className="font-medium">Total payable</span>
            <span className="font-bold">{formatAmount(bill.totalPayable ?? bill.subtotal)}</span>
          </div>
          <div className="flex justify-between gap-4 text-emerald-700">
            <span>Amount paid</span>
            <span className="font-medium">{formatAmount(bill.amountPaid)}</span>
          </div>
        </div>
      </div>

      <p className="text-center text-sm font-medium" style={{ color: BRAND_GREEN }}>
        {invoiceSettings.footerNote || "Thank you for choosing Bin Khalid Dairy Farm"}
      </p>
    </div>
  );
}
