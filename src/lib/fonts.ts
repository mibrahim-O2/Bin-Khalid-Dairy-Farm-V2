import { Noto_Nastaliq_Urdu } from "next/font/google";

// Self-hosted at build time by next/font (no runtime CDN dependency), per
// DESIGN.md's typography rule for Urdu text on invoices/notices. Scoped to
// its own module (not layout.tsx) since only the bilingual invoice
// template needs it — the rest of the app's UI is English-only.
export const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  variable: "--font-urdu",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});
