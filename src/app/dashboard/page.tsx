import { getServerSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardPage() {
  const session = await getServerSession();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="text-muted-foreground">Signed in as {session?.email}</p>
      <LogoutButton />
    </main>
  );
}
