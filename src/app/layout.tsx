import type { Metadata } from "next";
import { Manrope, Fraunces, Geist_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted at build time by next/font (no runtime CDN dependency), per
// DESIGN.md's typography rule. Manrope is the UI sans; Fraunces is the
// bolder slab/serif reserved for the "Bin Khalid Dairy Farm" wordmark.
const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bin Khalid Dairy Farm",
  description:
    "Dairy farm management, billing, and ledger system for Bin Khalid Dairy Farm.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
