"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format-date";
import { approvePendingUser, rejectPendingUser } from "./actions";

export type PendingUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
};

export function PendingUsersList({ initialUsers }: { initialUsers: PendingUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deliberately no router.refresh() here: this list's source of truth is
  // Firebase Auth's listUsers() export, which has a brief propagation lag
  // after a mutation (deleteUser/setCustomUserClaims) — refreshing right
  // away can refetch a still-stale list and silently undo this optimistic
  // removal, making an already-successful approve/reject look like it
  // failed (confirmed live: getUser() showed the account gone immediately
  // after reject, but a refresh right after briefly redrew the old row).
  // This local filter is the correct, immediate reflection of the
  // mutation that already succeeded; a real page load afterward always
  // sees fresh data regardless.
  async function handleApprove(uid: string) {
    setBusyUid(uid);
    setError(null);
    const result = await approvePendingUser({ uid });
    setBusyUid(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUsers((current) => current.filter((u) => u.uid !== uid));
  }

  async function handleReject(uid: string): Promise<boolean> {
    setBusyUid(uid);
    setError(null);
    const result = await rejectPendingUser({ uid });
    setBusyUid(null);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setUsers((current) => current.filter((u) => u.uid !== uid));
    return true;
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
                      <div className="flex justify-end gap-2">
                        <RejectUserDialog
                          user={user}
                          disabled={busyUid === user.uid}
                          onReject={() => handleReject(user.uid)}
                        />
                        <Button
                          size="sm"
                          disabled={busyUid === user.uid}
                          onClick={() => handleApprove(user.uid)}
                        >
                          Approve
                        </Button>
                      </div>
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

function RejectUserDialog({
  user,
  disabled,
  onReject,
}: {
  user: PendingUser;
  disabled: boolean;
  onReject: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  async function handleConfirm() {
    setRejecting(true);
    const ok = await onReject();
    setRejecting(false);
    if (ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm" disabled={disabled}>
            Reject
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {user.displayName ?? user.email ?? "this sign-up"}?</DialogTitle>
          <DialogDescription>
            This permanently deletes their account — they&apos;ll need to sign up again if they
            should actually have access. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" disabled={rejecting} onClick={handleConfirm}>
            Yes, reject and delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
