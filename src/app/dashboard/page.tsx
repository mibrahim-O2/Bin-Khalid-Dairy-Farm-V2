import { Users, Truck, HandCoins, Milk, ShoppingCart, Wallet, Landmark, ArrowDownToLine, Beef, PawPrint, Baby, Sparkles, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/db/dashboard-stats";
import { getLivestockSummary } from "@/lib/db/livestock-stats";
import { formatAmount } from "@/lib/format-number";
import { StatCard } from "./stat-card";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Server Component — every number below is a live query at request time
// (see src/lib/db/dashboard-stats.ts), no cached/denormalized totals row.
export default async function DashboardPage() {
  let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;
  let livestock: Awaited<ReturnType<typeof getLivestockSummary>> | null = null;
  try {
    [stats, livestock] = await Promise.all([getDashboardStats(), getLivestockSummary()]);
  } catch {
    stats = null;
  }

  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          A live look at how the farm is doing — {monthLabel}.
        </p>
      </div>

      {!stats || !livestock ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium text-foreground">Database isn&apos;t configured yet.</p>
            <p className="mt-1 text-muted-foreground">
              Fill in <code>.env.local</code> from <code>.env.local.example</code> to see live
              numbers here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Headline — the two numbers that answer "who owes whom, right now." */}
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Customer Outstanding"
              value={formatAmount(stats.customerOutstanding)}
              sublabel={`Owed to the farm by ${stats.activeCustomers} active customer${stats.activeCustomers === 1 ? "" : "s"}`}
              icon={Wallet}
              size="lg"
              valueClassName="text-success"
            />
            <StatCard
              label="Supplier Payable"
              value={formatAmount(stats.supplierPayable)}
              sublabel={`Owed by the farm to ${stats.activeSuppliers} active supplier${stats.activeSuppliers === 1 ? "" : "s"}`}
              icon={Landmark}
              size="lg"
              valueClassName="text-warning"
            />
          </div>

          {/* This month */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              This month
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                label="Milk Volume — Today"
                value={`${formatAmount(stats.milkVolumeToday)} L`}
                sublabel="Litres billed today"
                icon={Milk}
                delayMs={0}
              />
              <StatCard
                label="Milk Revenue"
                value={formatAmount(stats.milkRevenueThisMonth)}
                sublabel={`${formatAmount(stats.milkVolumeThisMonth)} litres billed this month`}
                icon={Milk}
                delayMs={30}
              />
              <StatCard
                label="Payments Received"
                value={formatAmount(stats.paymentsReceivedThisMonth)}
                sublabel="From customers"
                icon={ArrowDownToLine}
                delayMs={60}
              />
              <StatCard
                label="Purchases"
                value={formatAmount(stats.purchasesThisMonth)}
                sublabel="From suppliers"
                icon={ShoppingCart}
                delayMs={120}
              />
              <StatCard
                label="Net Owed to Staff"
                value={formatAmount(stats.employeeNetOwed)}
                sublabel={`${stats.activeEmployees} active employee${stats.activeEmployees === 1 ? "" : "s"}`}
                icon={HandCoins}
                delayMs={180}
              />
            </div>
          </div>

          {/* Livestock — active-only counts, rolled up by top-level group
              (see src/lib/db/livestock-stats.ts). "Other" only shows up
              once an admin has actually added a non-core category. */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Livestock
            </h2>
            <div className={`grid gap-4 sm:grid-cols-2 ${livestock.other > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
              <StatCard label="Buffalo" value={String(livestock.buffalo)} icon={PawPrint} delayMs={0} />
              <StatCard label="Cows" value={String(livestock.cow)} icon={Beef} delayMs={30} />
              <StatCard label="Calves" value={String(livestock.calf)} icon={Baby} delayMs={60} />
              {livestock.other > 0 ? (
                <StatCard label="Other" value={String(livestock.other)} icon={Sparkles} delayMs={90} />
              ) : null}
              <StatCard
                label="Total Animals"
                value={String(livestock.total)}
                sublabel="Active on the farm right now"
                icon={Layers}
                delayMs={120}
              />
            </div>
          </div>

          {/* At a glance */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              At a glance
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Active Customers" value={String(stats.activeCustomers)} icon={Users} delayMs={0} />
              <StatCard label="Active Suppliers" value={String(stats.activeSuppliers)} icon={Truck} delayMs={60} />
              <StatCard label="Active Employees" value={String(stats.activeEmployees)} icon={HandCoins} delayMs={120} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
