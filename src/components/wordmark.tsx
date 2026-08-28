import { cn } from "@/lib/utils";

/**
 * Text-based brand lockup used until the real farm logo image is wired in
 * (see MANUAL STEP in the phase report — the logo needs to land as an
 * actual file in this repo, e.g. public/logo.png).
 */
export function Wordmark({
  className,
  onDark = false,
}: {
  className?: string;
  /** Use on a dark-green surface (e.g. the dashboard sidebar) instead of the ivory background. */
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-sm font-bold",
          onDark ? "bg-brand-gold text-[#0D2818]" : "bg-primary text-primary-foreground"
        )}
      >
        BK
      </span>
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
    </span>
  );
}
