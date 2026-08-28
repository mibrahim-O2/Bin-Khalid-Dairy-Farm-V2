import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Bin Khalid Dairy Farm</h1>
      <p className="max-w-sm text-muted-foreground">
        Management, billing, and ledger system. Landing page design coming in a later phase.
      </p>
      <Button render={<Link href="/login" />}>Sign in</Button>
    </main>
  );
}
