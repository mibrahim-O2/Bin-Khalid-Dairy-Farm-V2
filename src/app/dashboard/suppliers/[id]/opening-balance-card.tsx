"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SupplierLedgerDirection, SupplierLedgerTransaction } from "@/types/supplier";
import { formatAmount } from "@/lib/format-number";
import { setSupplierOpeningBalance } from "../actions";

export function OpeningBalanceCard({
  supplierId,
  hasOpeningBalance,
  entry,
}: {
  supplierId: string;
  hasOpeningBalance: boolean;
  entry: SupplierLedgerTransaction | null;
}) {
  const router = useRouter();
  const [direction, setDirection] = useState<SupplierLedgerDirection>("debit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    if (!note.trim()) {
      setError("A short note explaining the opening balance is required.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await setSupplierOpeningBalance({
      supplierId,
      direction,
      amount: parsedAmount,
      note: note.trim(),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (hasOpeningBalance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Opening balance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {entry ? (
            <>
              <p className="text-foreground">
                {entry.direction === "debit" ? "Farm owed" : "Farm had credit of"}{" "}
                <span className="font-medium">{formatAmount(entry.amount)}</span> when added to
                this system.
              </p>
              <p className="mt-1">{entry.note}</p>
            </>
          ) : (
            "No opening balance entry found."
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set opening balance</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          One-time starting balance from before this supplier was added to the system. This is
          recorded as a permanent ledger entry — it can&apos;t be edited afterward.
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="opening-direction">Type</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as SupplierLedgerDirection)}>
                <SelectTrigger id="opening-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Farm owes supplier</SelectItem>
                  <SelectItem value="credit">Farm has credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="opening-amount">Amount</Label>
              <Input
                id="opening-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="opening-note">Note</Label>
            <Textarea
              id="opening-note"
              placeholder="e.g. Carried over from the old register, as of Jan 2026"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={saving} className="self-start">
            Record opening balance
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
