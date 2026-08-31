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
import { deleteCustomer } from "../actions";

export function DeleteCustomerDialog({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await deleteCustomer({ customerId, reason: reason.trim() || undefined });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/customers");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm">Delete customer</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete {customerName}?</DialogTitle>
          <DialogDescription>
            This cannot be undone. {customerName}&apos;s profile and rate schedule will be gone
            for good. Their bills, payments, and ledger history are never deleted — they&apos;ll
            remain in the system for the record, just without a linked customer.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-reason">Reason (optional)</Label>
            <Textarea
              id="delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={saving}>
              Yes, permanently delete
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
