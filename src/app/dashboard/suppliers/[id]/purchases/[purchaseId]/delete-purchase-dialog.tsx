"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deletePurchase } from "../actions";

/** Owner-only — see deletePurchase's doc comment for why this replaced Void. */
export function DeletePurchaseDialog({
  purchaseId,
  supplierId,
}: {
  purchaseId: string;
  supplierId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [createReplacement, setCreateReplacement] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await deletePurchase({ purchaseId, reason: reason.trim() || undefined, createReplacement });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    if (result.replacementPurchaseId) {
      router.push(`/dashboard/suppliers/${supplierId}/purchases/${result.replacementPurchaseId}`);
    } else {
      // Full navigation, not router.push — this dialog is used both from
      // the purchase editor page and from the Ledger itself, and a push
      // to a route we may already be on won't force a re-fetch of the
      // now-stale Router Cache.
      window.location.assign(`/dashboard/suppliers/${supplierId}/ledger`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive">Delete purchase</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this purchase?</DialogTitle>
          <DialogDescription>
            This permanently removes this purchase and its amount from the ledger and database.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-purchase-reason">Reason (optional)</Label>
            <Textarea
              id="delete-purchase-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Create a replacement draft</p>
              <p className="text-xs text-muted-foreground">
                Pre-fills a new draft with the same details, ready to correct and re-finalize.
              </p>
            </div>
            <Switch checked={createReplacement} onCheckedChange={setCreateReplacement} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={saving}>
              Yes, delete purchase
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
