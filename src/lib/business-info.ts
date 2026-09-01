// Placeholder farm business info for the printable/shareable invoice and
// statement templates. SYSTEM_ARCHITECTURE.md's data model reserves
// /settings/business and /settings/invoices for this (Phase 9's Settings
// module) — until that exists, these are plain constants. Move this into
// an editable Settings page in Phase 9 rather than adding more fields
// here.
export const businessInfo = {
  name: "Bin Khalid Dairy Farm",
  nameUrdu: "بن خالد ڈیری فارم",
  phone: null as string | null,
  address: null as string | null,
};
