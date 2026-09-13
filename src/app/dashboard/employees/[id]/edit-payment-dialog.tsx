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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuthorizedPerson } from "@/types/employee";
import type { EmployeePayment, EmployeePaymentSource } from "@/types/employee-payment";
import { updateEmployeePayment } from "../actions";

export function EditPaymentDialog({
  payment,
  authorizedPeople,
}: {
  payment: EmployeePayment;
  authorizedPeople: AuthorizedPerson[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [source, setSource] = useState<EmployeePaymentSource>(payment.source);
  const [givenBy, setGivenBy] = useState(payment.givenBy);
  const [note, setNote] = useState(payment.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    if (!givenBy) {
      setError("Select who gave this advance/payment.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await updateEmployeePayment({
      paymentId: payment.id,
      amount: parsedAmount,
      source,
      givenBy,
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
          setAmount(String(payment.amount));
          setSource(payment.source);
          setGivenBy(payment.givenBy);
          setNote(payment.note ?? "");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit advance/payment</DialogTitle>
          <DialogDescription>Updates the amount and keeps the ledger balance in sync.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-payment-amount">Amount</Label>
              <Input
                id="edit-payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-payment-source">Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as EmployeePaymentSource)}>
                <SelectTrigger id="edit-payment-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ghar">Ghar</SelectItem>
                  <SelectItem value="dukan">Dukan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-payment-given-by">Given by</Label>
            <Select value={givenBy} onValueChange={(v) => setGivenBy(v ?? "")}>
              <SelectTrigger id="edit-payment-given-by">
                <SelectValue placeholder="Select who gave it" />
              </SelectTrigger>
              <SelectContent>
                {authorizedPeople.map((person) => (
                  <SelectItem key={person.id} value={person.name}>
                    {person.name}
                  </SelectItem>
                ))}
                {!authorizedPeople.some((p) => p.name === givenBy) && givenBy ? (
                  <SelectItem value={givenBy}>{givenBy}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-payment-note">Note (optional)</Label>
            <Textarea id="edit-payment-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
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
