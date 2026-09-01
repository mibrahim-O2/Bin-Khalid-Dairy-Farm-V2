import { notoNastaliqUrdu } from "@/lib/fonts";

/**
 * A static label shown in both languages — English above, Urdu (Nastaliq,
 * RTL) below — for the printable/shareable bill and statement templates.
 * Shared by BillInvoiceTemplate, SupplierStatementTemplate, and
 * EmployeeStatementTemplate. See DESIGN.md's bilingual requirement and
 * bill-invoice-template.tsx's doc comment for the scope: labels/headings
 * are bilingual, the underlying data isn't machine-translated.
 */
export function BilingualLabel({ en, ur }: { en: string; ur: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span>{en}</span>
      <span dir="rtl" className={`${notoNastaliqUrdu.className} text-[13px] text-neutral-500`}>
        {ur}
      </span>
    </span>
  );
}
