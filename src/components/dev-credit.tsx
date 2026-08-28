import Image from "next/image";

export function DevCredit() {
  return (
    <a
      href="https://github.com/mibrahim-O2"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <span>Made with ❤️ by</span>
      <Image
        src="https://github.com/mibrahim-O2.png"
        alt="Muhammad Ibrahim"
        width={20}
        height={20}
        className="rounded-full"
      />
      <span className="font-medium text-foreground">Muhammad Ibrahim</span>
    </a>
  );
}
