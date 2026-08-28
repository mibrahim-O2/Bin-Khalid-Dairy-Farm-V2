import { Users, Truck, HandCoins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminDb } from "@/lib/firebase/admin";

type Counts =
  | { ok: true; customers: number; suppliers: number; employees: number }
  | { ok: false };

async function getCounts(): Promise<Counts> {
  try {
    const db = getAdminDb();
    const [customers, suppliers, employees] = await Promise.all([
      db.collection("customers").count().get(),
      db.collection("suppliers").count().get(),
      db.collection("employees").count().get(),
    ]);
    return {
      ok: true,
      customers: customers.data().count,
      suppliers: suppliers.data().count,
      employees: employees.data().count,
    };
  } catch {
    // No Firebase project configured yet, or a transient error — the
    // dashboard shell should still render, just without live numbers.
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
            <p className="font-medium text-foreground">Firebase isn&apos;t configured yet.</p>
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
