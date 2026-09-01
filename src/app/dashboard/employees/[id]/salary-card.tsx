"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import { setEmployeeSalary } from "./salary-actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function SetSalaryDialog({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [monthlySalary, setMonthlySalary] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const salary = Number(monthlySalary);
    if (!Number.isFinite(salary) || salary <= 0) {
      setError("Enter a valid monthly salary greater than zero.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await setEmployeeSalary({
      employeeId,
      monthlySalary: salary,
      effectiveFrom,
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

export function SalaryCard({
  employeeId,
  history,
}: {
  employeeId: string;
  history: EmployeeSalaryHistoryEntry[];
}) {
  const current = getCurrentSalary(history);

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
        {history.length > 1 ? (
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
