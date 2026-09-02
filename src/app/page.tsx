import Link from "next/link";
import Image from "next/image";
import { MessageCircle, Receipt, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wordmark } from "@/components/wordmark";
import { DevCredit } from "@/components/dev-credit";
import { ScrollReveal } from "@/components/scroll-reveal";
import { ProductsShowcase } from "@/components/landing/products-showcase";
import { FoundersSection } from "@/components/landing/founders-section";
import { getBusinessSettings } from "@/lib/db/settings";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const overview = [
  {
    icon: Receipt,
    title: "Customer Billing",
    description:
      "Milk and product bills calculated automatically, with a running ledger so every customer's balance is always accurate.",
  },
  {
    icon: Truck,
    title: "Supplier Tracking",
    description:
      "Purchases and payments to farm suppliers recorded in one place, with monthly statements generated on demand.",
  },
  {
    icon: Users,
    title: "Staff Management",
    description:
      "Salaries and advances tracked per employee, so it's always clear who's owed what — and who's taken an advance.",
  },
];

// Server Component — reads Settings once at request time, matching every
// other page in the app, so a phone number saved in Settings shows up here
// (both in the WhatsApp CTA and the contact line) without a redeploy.
export default async function Home() {
  const businessInfo = await getBusinessSettings();
  const whatsappLink = businessInfo.phone ? buildWhatsAppLink(businessInfo.phone, "Hi! I'd like to get in touch with Bin Khalid Dairy Farm.") : null;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Wordmark />
          <div className="flex items-center gap-2">
            {whatsappLink ? (
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                render={<a href={whatsappLink} target="_blank" rel="noopener noreferrer" />}
              >
                <MessageCircle /> WhatsApp
              </Button>
            ) : null}
            <Button render={<Link href="/login" />}>Sign in</Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — text on the left, a large animated logo on the right (DOM
            order keeps text first so it stacks above the logo on mobile). */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:gap-16 lg:py-16">
          <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
            <ScrollReveal>
              <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
                {businessInfo.address ?? "Shahdadpur, Sindh"}
              </span>
            </ScrollReveal>
            <ScrollReveal delayMs={80}>
              <h1 className="max-w-xl font-heading text-4xl font-bold leading-tight text-foreground sm:text-5xl">
                Trusted by Generations. Delivered Fresh Daily.
              </h1>
            </ScrollReveal>
            <ScrollReveal delayMs={160}>
              <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
                Bin Khalid Dairy Farm has served Shahdadpur with pure milk and honest
                dealing for generations now backed by a management system that keeps
                every account just as transparent.
              </p>
            </ScrollReveal>
            <ScrollReveal delayMs={240}>
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                {whatsappLink ? (
                  <Button size="lg" render={<a href={whatsappLink} target="_blank" rel="noopener noreferrer" />}>
                    <MessageCircle /> Chat on WhatsApp
                  </Button>
                ) : null}
                <Button size="lg" variant={whatsappLink ? "outline" : "default"} render={<Link href="/login" />}>
                  Sign in to Dashboard
                </Button>
              </div>
            </ScrollReveal>
          </div>

          <div className="flex justify-center lg:justify-end">
            <Image
              src="/logoDairy.png"
              alt="Bin Khalid Dairy Farm"
              width={1254}
              height={1254}
              priority
              className="hero-logo size-56 object-contain sm:size-72 lg:size-80"
            />
          </div>
        </section>

        {/* Overview */}
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            {overview.map(({ icon: Icon, title, description }, index) => (
              <ScrollReveal key={title} delayMs={index * 100}>
                <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle>{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Products */}
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-28">
          <ScrollReveal>
            <div className="mb-6 flex flex-col items-center gap-1.5 text-center sm:mb-8">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C9A227" }}>
                From the farm
              </span>
              <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Our Products</h2>
              <p className="max-w-md text-sm text-muted-foreground sm:text-base">
                Fresh, pure, and delivered daily everything the farm produces.
              </p>
            </div>
          </ScrollReveal>
          <ProductsShowcase />
        </section>

        <FoundersSection />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Bin Khalid Dairy Farm. All rights reserved.
          </p>
          <DevCredit />
        </div>
      </footer>
    </div>
  );
}
