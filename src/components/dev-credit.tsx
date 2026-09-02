import Image from "next/image";

/**
 * The developer-credit footnote required by DESIGN.md §4 — GitHub avatar +
 * "Made with ❤️ by [name]" + a link to the profile. Deliberately its own
 * small card (not a bare inline link) so it reads as a considered
 * footnote rather than an afterthought, while staying well below the
 * farm's own branding in visual weight per the design doc.
 */
export function DevCredit() {
  return (
    <a
      href="https://github.com/mibrahim-O2"
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <Image
        src="https://github.com/mibrahim-O2.png"
        alt="Muhammad Ibrahim"
        width={36}
        height={36}
        className="size-9 rounded-full ring-1 ring-border"
      />
      <span className="flex flex-col items-start text-left leading-tight">
        <span className="text-xs text-muted-foreground">Made with ❤️ by</span>
        <span className="text-sm font-semibold text-foreground group-hover:text-primary">
          Muhammad Ibrahim
        </span>
      </span>
    </a>
  );
}
