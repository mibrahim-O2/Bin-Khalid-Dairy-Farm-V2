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
import type { SupplierStatement } from "@/types/supplier-statement";
import { deleteSupplierStatement, generateSupplierStatement } from "./statements/actions";

function firstOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function GenerateStatementDialog({ supplierId }: { supplierId: string }) {
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
    const result = await generateSupplierStatement({ supplierId, startDate, endDate });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.push(`/dashboard/suppliers/${supplierId}/statements/${result.statementId}`);
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

function DeleteStatementDialog({ statementId, onDeleted }: { statementId: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    const result = await deleteSupplierStatement({ statementId });
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    onDeleted();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger render={<Button variant="destructive" size="sm">Delete</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this statement?</DialogTitle>
          <DialogDescription>
            This removes the generated document only — it never affects the underlying purchases,
            payments, or ledger transactions it was generated from. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="destructive" disabled={deleting} onClick={handleConfirm}>
            Yes, delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StatementsCard({
  supplierId,
  statements,
  isOwner,
}: {
  supplierId: string;
  statements: SupplierStatement[];
  isOwner: boolean;
}) {
  const router = useRouter();
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">Statements</h2>
          <GenerateStatementDialog supplierId={supplierId} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Closing balance</TableHead>
                <TableHead>Generated</TableHead>
                {isOwner ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isOwner ? 4 : 3} className="text-center text-muted-foreground">
                    No statements yet.
                  </TableCell>
                </TableRow>
              ) : (
                statements.map((statement) => (
                  <TableRow key={statement.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link
                        href={`/dashboard/suppliers/${supplierId}/statements/${statement.id}`}
                        className="hover:underline"
                      >
                        {formatDate(statement.startDate)} – {formatDate(statement.endDate)}
                      </Link>
                    </TableCell>
                    <TableCell>{formatAmount(statement.closingBalance)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(statement.createdAt)}
                    </TableCell>
                    {isOwner ? (
                      <TableCell className="text-right">
                        <DeleteStatementDialog statementId={statement.id} onDeleted={() => router.refresh()} />
                      </TableCell>
                    ) : null}
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
