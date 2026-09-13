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
import type { EmployeeSalaryAccrual } from "@/types/salary-accrual";
import { updateSalaryAccrual } from "../actions";

export function EditAccrualDialog({ accrual }: { accrual: EmployeeSalaryAccrual }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(accrual.periodStart);
  const [periodEnd, setPeriodEnd] = useState(accrual.periodEnd);
  const [amount, setAmount] = useState(String(accrual.amount));
  const [note, setNote] = useState(accrual.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    if (periodEnd < periodStart) {
      setError("Period end must be on or after the period start.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await updateSalaryAccrual({
      accrualId: accrual.id,
      periodStart,
      periodEnd,
      amount: parsedAmount,
      note: note.trim() || undefined,
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPeriodStart(accrual.periodStart);
          setPeriodEnd(accrual.periodEnd);
          setAmount(String(accrual.amount));
          setNote(accrual.note ?? "");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit salary accrual</DialogTitle>
          <DialogDescription>
            Any leave deduction already applied to this accrual stays as recorded — this only
            changes the period, amount, and note.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-accrual-period-start">Period start</Label>
              <Input
                id="edit-accrual-period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-accrual-period-end">Period end</Label>
              <Input
                id="edit-accrual-period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-accrual-amount">Amount</Label>
            <Input
              id="edit-accrual-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-accrual-note">Note (optional)</Label>
            <Textarea id="edit-accrual-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
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
