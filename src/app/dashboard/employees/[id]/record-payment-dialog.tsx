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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuthorizedPerson } from "@/types/employee";
import type { EmployeePaymentSource } from "@/types/employee-payment";
import { recordEmployeePayment } from "../actions";

export function RecordPaymentDialog({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<AuthorizedPerson[]>([]);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<EmployeePaymentSource>("ghar");
  const [givenBy, setGivenBy] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const db = getFirebaseDb();
    const q = query(
      collection(db, "authorizedPeople"),
      where("active", "==", true),
      orderBy("name")
    );
    return onSnapshot(q, (snapshot) => {
      setPeople(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AuthorizedPerson));
    });
  }, [open]);

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
    const result = await recordEmployeePayment({
      employeeId,
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
    setAmount("");
    setGivenBy("");
    setNote("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Record payment</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record advance/payment</DialogTitle>
          <DialogDescription>
            Reduces what the farm owes this employee — taken against future, not-yet-earned
            salary.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-source">Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as EmployeePaymentSource)}>
                <SelectTrigger id="payment-source">
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
            <Label htmlFor="payment-given-by">Given by</Label>
            <Select value={givenBy} onValueChange={(v) => setGivenBy(v ?? "")}>
              <SelectTrigger id="payment-given-by">
                <SelectValue placeholder="Select who gave it" />
              </SelectTrigger>
              <SelectContent>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.name}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {people.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No authorized people yet — add one on the Employees page first.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-note">Note (optional)</Label>
            <Textarea
              id="payment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
