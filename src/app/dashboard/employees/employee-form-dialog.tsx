"use client";

import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
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
import type { Employee } from "@/types/employee";

type EmployeeFormDialogProps = {
  employee?: Employee;
  trigger: React.ReactElement;
  onCreated?: (employeeId: string) => void;
};

export function EmployeeFormDialog({ employee, trigger, onCreated }: EmployeeFormDialogProps) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(employee?.name ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [address, setAddress] = useState(employee?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(employee?.name ?? "");
      setPhone(employee?.phone ?? "");
      setAddress(employee?.address ?? "");
      setError(null);
    }
  }, [open, employee]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
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
      if (employee) {
        await updateDoc(doc(db, "employees", employee.id), {
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          updatedAt: now,
        });
      } else {
        const ref = await addDoc(collection(db, "employees"), {
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          active: true,
          balance: 0,
          hasOpeningBalance: false,
          createdAt: now,
          updatedAt: now,
          createdBy: user.uid,
        });
        onCreated?.(ref.id);
      }
      setOpen(false);
    } catch {
      setError("Failed to save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {employee
              ? "Update this employee's details."
              : "Basic details — salary and opening balance are set from the employee's page."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="employee-name">Name</Label>
            <Input id="employee-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="employee-phone">Phone</Label>
            <Input
              id="employee-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="employee-address">Address</Label>
            <Textarea
              id="employee-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {employee ? "Save changes" : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
