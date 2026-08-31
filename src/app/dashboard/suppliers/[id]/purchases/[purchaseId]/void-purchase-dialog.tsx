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
import { voidPurchase } from "../actions";

export function VoidPurchaseDialog({
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
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await voidPurchase({ purchaseId, reason: reason.trim(), createReplacement });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    if (result.replacementPurchaseId) {
      router.push(`/dashboard/suppliers/${supplierId}/purchases/${result.replacementPurchaseId}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Void purchase</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this purchase</DialogTitle>
          <DialogDescription>
            This never deletes or edits the finalized amounts — it records a reversing credit and
            marks the purchase void, permanently.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              required
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
              Void purchase
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
