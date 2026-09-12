"use client";

import { useState, type FormEvent } from "react";
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
import { deleteSupplier } from "../actions";

export function DeleteSupplierDialog({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await deleteSupplier({ supplierId, reason: reason.trim() || undefined });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Full navigation, not router.push()+refresh() — see
    // DeleteCustomerDialog's identical comment for why: avoids briefly
    // showing the just-deleted supplier from a stale Router Cache entry.
    window.location.assign("/dashboard/suppliers");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm">Delete supplier</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete {supplierName}?</DialogTitle>
          <DialogDescription>
            This will permanently delete {supplierName} <strong>and all their purchases, payments,
            and ledger history</strong>. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-supplier-reason">Reason (optional)</Label>
            <Textarea
              id="delete-supplier-reason"
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
