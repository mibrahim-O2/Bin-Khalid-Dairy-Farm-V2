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
import { voidSalaryAccrual } from "../actions";

export function VoidAccrualDialog({ accrualId }: { accrualId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
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
    const result = await voidSalaryAccrual({ accrualId, reason: reason.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Void</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this salary accrual</DialogTitle>
          <DialogDescription>
            This never deletes or edits the original — it records a reversing debit and marks the
            accrual void, permanently.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="void-accrual-reason">Reason</Label>
            <Textarea
              id="void-accrual-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={saving}>
              Void accrual
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
