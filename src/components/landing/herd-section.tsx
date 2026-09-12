import { Beef, Layers, PawPrint, Baby } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getLivestockSummary } from "@/lib/db/livestock-stats";

const stats = [
  { key: "buffalo" as const, label: "Buffalo", icon: PawPrint },
  { key: "cow" as const, label: "Cows", icon: Beef },
  { key: "calf" as const, label: "Calves", icon: Baby },
];

/**
 * Public-facing counterpart to the dashboard's Livestock section — same
 * getLivestockSummary() query (no auth needed, it only ever returns
 * aggregate counts), presented as a brief "our herd" banner rather than a
 * data table. Server Component, same as the rest of the landing page.
 */
export async function HerdSection() {
  let summary: Awaited<ReturnType<typeof getLivestockSummary>> | null = null;
  try {
    summary = await getLivestockSummary();
  } catch {
    summary = null;
  }

  // Nothing to show yet (DB not configured, or no animals recorded) —
  // quietly omit the section rather than showing an empty/zeroed banner.
  if (!summary || summary.total === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
      <ScrollReveal>
        <div className="mb-6 flex flex-col items-center gap-1.5 text-center sm:mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C9A227" }}>
            From the farm
          </span>
          <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Our Herd</h2>
          <p className="max-w-md text-sm text-muted-foreground sm:text-base">
            Every drop starts here — the animals that make Bin Khalid Dairy Farm possible.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ScrollReveal delayMs={0}>
          <Card className="h-full text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
            <CardContent className="flex flex-col items-center gap-2 pt-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Layers className="size-5" />
              </div>
              <p className="font-heading text-2xl font-bold text-foreground">{summary.total}</p>
              <p className="text-sm text-muted-foreground">Total Animals</p>
            </CardContent>
          </Card>
        </ScrollReveal>
        {stats.map(({ key, label, icon: Icon }, index) => (
          <ScrollReveal key={key} delayMs={(index + 1) * 60}>
            <Card className="h-full text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
              <CardContent className="flex flex-col items-center gap-2 pt-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </div>
                <p className="font-heading text-2xl font-bold text-foreground">{summary[key]}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
