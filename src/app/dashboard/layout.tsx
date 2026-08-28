import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

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

  return <>{children}</>;
}
