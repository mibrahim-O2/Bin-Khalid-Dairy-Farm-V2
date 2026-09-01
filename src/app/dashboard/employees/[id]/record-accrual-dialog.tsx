"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { getCurrentSalary, type EmployeeSalaryHistoryEntry } from "@/types/employee-salary";
import { recordSalaryAccrual } from "../actions";

function firstOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function lastOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

export function RecordAccrualDialog({
  employeeId,
  salaryHistory,
}: {
  employeeId: string;
  salaryHistory: EmployeeSalaryHistoryEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(firstOfMonthIso());
  const [periodEnd, setPeriodEnd] = useState(lastOfMonthIso());
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resets the form and does the initial pre-fill together, in the same
  // effect — salaryHistory is now a stable server-fetched prop (not a live
  // Firestore subscription that handed back a fresh array reference on
  // every open), so a separate salaryHistory-keyed effect below would not
  // re-run on a second open with unchanged data, leaving amount stuck at
  // the "" this effect resets it to.
  useEffect(() => {
    if (!open) return;
    const start = firstOfMonthIso();
    setPeriodStart(start);
    setPeriodEnd(lastOfMonthIso());
    setAmountTouched(false);
    setNote("");
    setError(null);
    const current = getCurrentSalary(salaryHistory, start);
    setAmount(current ? String(current.monthlySalary) : "");
    // Only the open transition should reset the form — salaryHistory is
    // read fresh via getCurrentSalary() above, not tracked as a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-prefills live as the user changes the period start while the dialog
  // stays open — still freely editable (e.g. a partial month, a bonus).
  useEffect(() => {
    if (!open || amountTouched) return;
    const current = getCurrentSalary(salaryHistory, periodStart);
    if (current) setAmount(String(current.monthlySalary));
  }, [open, salaryHistory, periodStart, amountTouched]);

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
    const result = await recordSalaryAccrual({
      employeeId,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Record salary accrual</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record salary accrual</DialogTitle>
          <DialogDescription>
            Credits this period&apos;s salary to the employee&apos;s balance. Amount is pre-filled
            from the salary in effect at the period start — adjust it for a partial month or
            bonus.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="accrual-period-start">Period start</Label>
              <Input
                id="accrual-period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="accrual-period-end">Period end</Label>
              <Input
                id="accrual-period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="accrual-amount">Amount</Label>
            <Input
              id="accrual-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmountTouched(true);
                setAmount(e.target.value);
              }}
              required
            />
            {salaryHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No salary set yet — set one on this employee&apos;s page, or enter an amount
                directly.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="accrual-note">Note (optional)</Label>
            <Textarea id="accrual-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Record accrual
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
