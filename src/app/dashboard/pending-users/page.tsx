import { getAdminAuth } from "@/lib/firebase/admin";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { Card, CardContent } from "@/components/ui/card";
import { PendingUsersList, type PendingUser } from "./pending-users-list";

async function listPendingUsers(): Promise<PendingUser[]> {
  const { users } = await getAdminAuth().listUsers(1000);
  return users
    .filter((user) => user.customClaims?.active !== true)
    .map((user) => ({
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      createdAt: user.metadata.creationTime,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export default async function PendingUsersPage() {
  const session = await getServerSession();

  // dashboard/layout.tsx already guarantees an active session reaches here,
  // but the Owner check is specific to this route and must be independent —
  // never inherited from the general active-user gate.
  if (!session || !isOwnerSession(session)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Pending Users</h1>
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            Access denied — only the account owner can approve pending users.
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingUsers = await listPendingUsers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Pending Users</h1>
        <p className="text-sm text-muted-foreground">
          Accounts that signed up and are waiting for approval.
        </p>
      </div>
      <PendingUsersList initialUsers={pendingUsers} />
    </div>
  );
}
