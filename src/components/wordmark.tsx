import Image from "next/image";
import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  onDark = false,
  showText = true,
}: {
  className?: string;
  /** Use on a dark-green surface (e.g. the dashboard sidebar) instead of the ivory background. */
  onDark?: boolean;
  /** Hide the "Bin Khalid Dairy Farm" text (the logo art already spells it out at larger sizes). */
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* Uses the logo pre-composited onto a light disc: the original is a
          transparent PNG with a dark-green rim that vanishes on a dark
          background (browser dark / force-dark mode, dark sidebar), and
          a CSS background disc gets inverted by force-dark, an image
          doesn't. */}
      <Image
        src="/logoDairy-disc.png"
        alt="Bin Khalid Dairy Farm"
        width={768}
        height={768}
        priority
        className="size-9 shrink-0 object-contain"
      />
      {showText ? (
        <span
          className={cn(
            "font-heading text-lg font-bold leading-none",
            onDark ? "text-white" : "text-foreground"
          )}
        >
          Bin Khalid{" "}
          <span
            className={cn(
              "block text-xs font-semibold tracking-wide",
              onDark ? "text-white/70" : "text-muted-foreground"
            )}
          >
            DAIRY FARM
          </span>
        </span>
      ) : null}
    </span>
  );
}
