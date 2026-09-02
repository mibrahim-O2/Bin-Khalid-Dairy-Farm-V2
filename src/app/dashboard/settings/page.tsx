import Link from "next/link";
import { Package, Truck, UserCheck, Wheat } from "lucide-react";
import { getBusinessSettings, getInvoiceSettings, getPaymentSettings } from "@/lib/db/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessInfoCard } from "./business-info-card";
import { PaymentAccountsCard } from "./payment-accounts-card";
import { InvoiceNoticeCard } from "./invoice-notice-card";

const manageLinks = [
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/farm-supplies", label: "Farm Supplies", icon: Wheat },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck },
  { href: "/dashboard/employees", label: "Employees & Authorized People", icon: UserCheck },
];

export default async function SettingsPage() {
  const [businessInfo, paymentSettings, invoiceSettings] = await Promise.all([
    getBusinessSettings(),
    getPaymentSettings(),
    getInvoiceSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Business info, payment accounts, and invoice notices shown on shared bills and
          statements.
        </p>
      </div>

      <BusinessInfoCard businessInfo={businessInfo} />
      <PaymentAccountsCard paymentSettings={paymentSettings} />
      <InvoiceNoticeCard invoiceSettings={invoiceSettings} />

      <Card>
        <CardHeader>
          <CardTitle>Manage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {manageLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
