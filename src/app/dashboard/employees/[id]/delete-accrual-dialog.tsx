"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteSalaryAccrual } from "../actions";

export function DeleteAccrualDialog({ accrualId }: { accrualId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setDeleting(true);
    setError(null);
    const result = await deleteSalaryAccrual({ accrualId, reason: reason.trim() || undefined });
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger render={<Button variant="outline" size="sm">Delete</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this salary accrual?</DialogTitle>
          <DialogDescription>
            This permanently removes this accrual and its amount from the ledger and database. If
            it had a leave deduction applied, that leave becomes available to apply to a future
            accrual again. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-accrual-reason">Reason (optional)</Label>
            <Textarea id="delete-accrual-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={deleting}>
              Yes, delete accrual
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
