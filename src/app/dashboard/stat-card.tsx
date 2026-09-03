import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal } from "@/components/scroll-reveal";
import { cn } from "@/lib/utils";

/**
 * One live stat tile for the dashboard overview. `size="lg"` is for the
 * handful of headline numbers (outstanding/payable) that deserve more
 * visual weight than the supporting grid around them — bigger type, nothing
 * else changes, per DESIGN.md's "no gradients/glassmorphism" rule.
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  size = "default",
  valueClassName,
  delayMs = 0,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  size?: "default" | "lg";
  /** e.g. text-success / text-warning to signal money-in vs money-out at a glance. */
  valueClassName?: string;
  delayMs?: number;
}) {
  return (
    <ScrollReveal delayMs={delayMs}>
      <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
        <CardContent className="flex items-start justify-between gap-4 pt-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p
              className={cn(
                "font-heading font-bold text-foreground",
                size === "lg" ? "text-3xl" : "text-2xl",
                valueClassName
              )}
            >
              {value}
            </p>
            {sublabel ? <p className="text-xs text-muted-foreground">{sublabel}</p> : null}
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-5" />
          </div>
        </CardContent>
      </Card>
    </ScrollReveal>
  );
}
