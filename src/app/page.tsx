import Link from "next/link";
import { Receipt, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wordmark } from "@/components/wordmark";
import { DevCredit } from "@/components/dev-credit";

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

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Wordmark />
          <Button render={<Link href="/login" />}>Sign in</Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="max-w-2xl font-heading text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            Running the farm&apos;s books, the honest way.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Bin Khalid Dairy Farm&apos;s management system — customer billing,
            supplier purchases, and staff salaries, each kept in a clear,
            accurate ledger.
          </p>
          <Button size="lg" render={<Link href="/login" />}>
            Sign in to the dashboard
          </Button>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="grid gap-4 sm:grid-cols-3">
            {overview.map(({ icon: Icon, title, description }) => (
              <Card key={title}>
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
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 text-center sm:px-6">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Bin Khalid Dairy Farm. All rights reserved.
          </p>
          <DevCredit />
        </div>
      </footer>
    </div>
  );
}
