"use client";

import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import { getCurrentSalary, type EmployeeSalaryHistoryEntry } from "@/types/employee-salary";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function SetSalaryDialog({ employeeId }: { employeeId: string }) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [monthlySalary, setMonthlySalary] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMonthlySalary("");
      setEffectiveFrom(todayIso());
      setNote("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const salary = Number(monthlySalary);
    if (!Number.isFinite(salary) || salary <= 0) {
      setError("Enter a valid monthly salary greater than zero.");
      return;
    }
    if (!user) {
      setError("Still loading your session — try again in a moment.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const now = new Date().toISOString();
      await addDoc(collection(db, "employeeSalaryHistory"), {
        employeeId,
        monthlySalary: salary,
        effectiveFrom,
        note: note.trim() || null,
        createdAt: now,
        createdBy: user.uid,
      });
      setOpen(false);
    } catch {
      setError("Failed to save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Set salary</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set monthly salary</DialogTitle>
          <DialogDescription>
            Adds a new entry to the salary history — it never overwrites an earlier one, so a
            change here never affects an already-finalized salary accrual.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="salary-amount">Monthly salary</Label>
              <Input
                id="salary-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="salary-effective-from">Effective from</Label>
              <Input
                id="salary-effective-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="salary-note">Note (optional)</Label>
            <Textarea id="salary-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SalaryCard({ employeeId }: { employeeId: string }) {
  const { user } = useCurrentUser();
  const [history, setHistory] = useState<EmployeeSalaryHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const q = query(
      collection(db, "employeeSalaryHistory"),
      where("employeeId", "==", employeeId),
      orderBy("effectiveFrom", "desc")
    );
    return onSnapshot(
      q,
      (snapshot) => {
        setHistory(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as EmployeeSalaryHistoryEntry));
      },
      () => setError("Failed to load salary history. Try refreshing the page.")
    );
  }, [employeeId, user]);

  const current = history ? getCurrentSalary(history) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle>Salary</CardTitle>
        <SetSalaryDialog employeeId={employeeId} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="font-heading text-2xl font-bold text-foreground">
            {current ? formatAmount(current.monthlySalary) : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            {current ? `per month, effective ${formatDate(current.effectiveFrom)}` : "No salary set yet."}
          </p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {history && history.length > 1 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective from</TableHead>
                  <TableHead>Monthly salary</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.effectiveFrom)}</TableCell>
                    <TableCell>{formatAmount(entry.monthlySalary)}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
