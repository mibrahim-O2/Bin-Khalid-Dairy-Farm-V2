import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { CustomerDetailClient } from "./customer-detail-client";

export default async function CustomerDetailPage() {
  const session = await getServerSession();
  const isOwner = session ? isOwnerSession(session) : false;

  return <CustomerDetailClient isOwner={isOwner} />;
}
