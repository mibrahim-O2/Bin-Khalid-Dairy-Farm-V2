"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import type { EmployeeStatement } from "@/types/employee-statement";
import { generateEmployeeStatement } from "./statements/actions";

function firstOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function GenerateStatementDialog({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(firstOfMonthIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await generateEmployeeStatement({ employeeId, startDate, endDate });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.push(`/dashboard/employees/${employeeId}/statements/${result.statementId}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Generate statement</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate statement</DialogTitle>
          <DialogDescription>
            A snapshot of every transaction in this range, with opening and closing balance.
            Immutable once created — generating again makes a new statement, it never edits
            an old one.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="statement-start">Start date</Label>
              <Input
                id="statement-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="statement-end">End date</Label>
              <Input
                id="statement-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StatementsCard({
  employeeId,
  statements,
}: {
  employeeId: string;
  statements: EmployeeStatement[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">Statements</h2>
          <GenerateStatementDialog employeeId={employeeId} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Closing balance</TableHead>
                <TableHead>Generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No statements yet.
                  </TableCell>
                </TableRow>
              ) : (
                statements.map((statement) => (
                  <TableRow key={statement.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link
                        href={`/dashboard/employees/${employeeId}/statements/${statement.id}`}
                        className="hover:underline"
                      >
                        {formatDate(statement.startDate)} – {formatDate(statement.endDate)}
                      </Link>
                    </TableCell>
                    <TableCell>{formatAmount(statement.closingBalance)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(statement.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
