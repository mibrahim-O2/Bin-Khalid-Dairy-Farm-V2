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
import { deleteCustomerPayment } from "../../actions";

/** Owner-only — see deleteCustomerPayment's doc comment for why this replaced Void. */
export function DeletePaymentDialog({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await deleteCustomerPayment({ paymentId, reason: reason.trim() || undefined });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger render={<Button variant="destructive" size="sm">Delete</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this payment?</DialogTitle>
          <DialogDescription>
            This permanently removes this payment and its amount from the ledger and database,
            restoring any bills it settled back to unpaid/partially-paid. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-payment-reason">Reason (optional)</Label>
            <Textarea
              id="delete-payment-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={saving}>
              Yes, delete payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
