"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format-date";
import { approvePendingUser } from "./actions";

export type PendingUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
};

export function PendingUsersList({ initialUsers }: { initialUsers: PendingUser[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [approvingUid, setApprovingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(uid: string) {
    setApprovingUid(uid);
    setError(null);
    const result = await approvePendingUser({ uid });
    setApprovingUid(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUsers((current) => current.filter((u) => u.uid !== uid));
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-0">
        {error ? (
          <p className="border-b border-border p-4 text-sm text-destructive">{error}</p>
        ) : null}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No pending users.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell className="font-medium text-foreground">
                      {user.displayName ?? "—"}
                    </TableCell>
                    <TableCell>{user.email ?? "—"}</TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={approvingUid === user.uid}
                        onClick={() => handleApprove(user.uid)}
                      >
                        Approve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
