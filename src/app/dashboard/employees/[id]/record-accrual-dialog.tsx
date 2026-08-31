"use client";

import { useEffect, useState, type FormEvent } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
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

export function RecordAccrualDialog({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<EmployeeSalaryHistoryEntry[]>([]);
  const [periodStart, setPeriodStart] = useState(firstOfMonthIso());
  const [periodEnd, setPeriodEnd] = useState(lastOfMonthIso());
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const db = getFirebaseDb();
    const q = query(
      collection(db, "employeeSalaryHistory"),
      where("employeeId", "==", employeeId),
      orderBy("effectiveFrom", "desc")
    );
    return onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as EmployeeSalaryHistoryEntry));
    });
  }, [employeeId, open]);

  useEffect(() => {
    if (open) {
      setPeriodStart(firstOfMonthIso());
      setPeriodEnd(lastOfMonthIso());
      setAmount("");
      setAmountTouched(false);
      setNote("");
      setError(null);
    }
  }, [open]);

  // Pre-fill the amount from the salary effective at the period's start —
  // still freely editable (e.g. a partial month, a bonus).
  useEffect(() => {
    if (amountTouched) return;
    const current = getCurrentSalary(history, periodStart);
    if (current) setAmount(String(current.monthlySalary));
  }, [history, periodStart, amountTouched]);

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
            {history.length === 0 ? (
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
