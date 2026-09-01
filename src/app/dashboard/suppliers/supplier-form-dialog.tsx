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
import type { Supplier } from "@/types/supplier";
import { createSupplier, updateSupplier } from "./crud-actions";

type SupplierFormDialogProps = {
  supplier?: Supplier;
  trigger: React.ReactElement;
  onCreated?: (supplierId: string) => void;
};

export function SupplierFormDialog({ supplier, trigger, onCreated }: SupplierFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(supplier?.name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(supplier?.name ?? "");
      setPhone(supplier?.phone ?? "");
      setAddress(supplier?.address ?? "");
      setError(null);
    }
  }, [open, supplier]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    if (supplier) {
      const result = await updateSupplier({ supplierId: supplier.id, name, phone, address });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
    } else {
      const result = await createSupplier({ name, phone, address });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.supplierId) onCreated?.(result.supplierId);
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? "Edit supplier" : "Add supplier"}</DialogTitle>
          <DialogDescription>
            {supplier
              ? "Update this supplier's details."
              : "Basic details — opening balance is set from the supplier's page."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-name">Name</Label>
            <Input id="supplier-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-phone">Phone</Label>
            <Input
              id="supplier-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-address">Address</Label>
            <Textarea
              id="supplier-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {supplier ? "Save changes" : "Add supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
