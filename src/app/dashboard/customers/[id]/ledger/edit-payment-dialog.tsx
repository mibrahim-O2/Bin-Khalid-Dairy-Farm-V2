"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { updateCustomerPayment } from "../../actions";

/** Owner-only. */
export function EditPaymentDialog({
  paymentId,
  amount,
  method,
  note,
}: {
  paymentId: string;
  amount: number;
  method: string | null;
  note: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amountInput, setAmountInput] = useState(String(amount));
  const [methodInput, setMethodInput] = useState(method ?? "");
  const [noteInput, setNoteInput] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid payment amount greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateCustomerPayment({
      paymentId,
      amount: parsedAmount,
      method: methodInput.trim() || undefined,
      note: noteInput.trim() || undefined,
    });
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
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit this payment</DialogTitle>
          <DialogDescription>
            Owner-only. Changing the amount re-applies it against the customer&apos;s outstanding
            bills from scratch, oldest first.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-payment-amount">Amount</Label>
            <Input
              id="edit-payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-payment-method">Method (optional)</Label>
            <Input id="edit-payment-method" value={methodInput} onChange={(e) => setMethodInput(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-payment-note">Note (optional)</Label>
            <Textarea id="edit-payment-note" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} rows={2} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
