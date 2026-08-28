import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.active) {
    redirect("/pending-approval");
  }

  return <DashboardShell email={session.email}>{children}</DashboardShell>;
}
