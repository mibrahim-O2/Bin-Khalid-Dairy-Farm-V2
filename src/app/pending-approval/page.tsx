import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

export default async function PendingApprovalPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.active) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Account pending approval</h1>
      <p className="max-w-sm text-muted-foreground">
        Your account ({session.email}) has been created but has not been activated yet.
        Contact a farm administrator to get access.
      </p>
    </main>
  );
}
