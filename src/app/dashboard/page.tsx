import { Users, Truck, HandCoins } from "lucide-react";
import { count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db/client";
import { customers, employees, suppliers } from "@/lib/db/schema";

type Counts =
  | { ok: true; customers: number; suppliers: number; employees: number }
  | { ok: false };

async function getCounts(): Promise<Counts> {
  try {
    // Customers (M2), suppliers (M6), and employees (M10) all live in
    // Postgres now.
    const db = getDb();
    const [[customerCount], [supplierCount], [employeeCount]] = await Promise.all([
      db.select({ value: count() }).from(customers),
      db.select({ value: count() }).from(suppliers),
      db.select({ value: count() }).from(employees),
    ]);
    return {
      ok: true,
      customers: customerCount.value,
      suppliers: supplierCount.value,
      employees: employeeCount.value,
    };
  } catch {
    // No Postgres configured yet, or a transient error — the dashboard
    // shell should still render, just without live numbers.
    return { ok: false };
  }
}

export default async function DashboardPage() {
  const counts = await getCounts();

  const stats = [
    { label: "Customers", icon: Users, value: counts.ok ? counts.customers : null },
    { label: "Suppliers", icon: Truck, value: counts.ok ? counts.suppliers : null },
    { label: "Employees", icon: HandCoins, value: counts.ok ? counts.employees : null },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview across all three ledgers.</p>
      </div>

      {!counts.ok ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium text-foreground">Database isn&apos;t configured yet.</p>
            <p className="mt-1 text-muted-foreground">
              Fill in <code>.env.local</code> from <code>.env.local.example</code> to see live
              counts here.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, icon: Icon, value }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="font-heading text-3xl font-bold text-foreground">{value ?? "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
