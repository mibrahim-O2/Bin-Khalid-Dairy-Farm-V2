"use client";

import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Product, ProductBillingType } from "@/types/customer";

type ProductFormDialogProps = {
  product?: Product;
  trigger: React.ReactElement;
};

export function ProductFormDialog({ product, trigger }: ProductFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product?.name ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "");
  const [billingType, setBillingType] = useState<ProductBillingType>(
    product?.billingType ?? "simple"
  );
  const [defaultRate, setDefaultRate] = useState(
    product ? String(product.defaultRate) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form fields whenever the dialog is (re)opened, so stale edits from
  // a previous open don't linger.
  useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setUnit(product?.unit ?? "");
      setBillingType(product?.billingType ?? "simple");
      setDefaultRate(product ? String(product.defaultRate) : "");
      setError(null);
    }
  }, [open, product]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const rate = Number(defaultRate);
    if (!name.trim() || !unit.trim() || !Number.isFinite(rate) || rate < 0) {
      setError("Enter a valid name, unit, and non-negative rate.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const now = new Date().toISOString();
      if (product) {
        await updateDoc(doc(db, "products", product.id), {
          name: name.trim(),
          unit: unit.trim(),
          billingType,
          defaultRate: rate,
          updatedAt: now,
        });
      } else {
        await addDoc(collection(db, "products"), {
          name: name.trim(),
          unit: unit.trim(),
          billingType,
          defaultRate: rate,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
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
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {product
              ? "Update this product's details."
              : "Products/services sold to customers (e.g. Milk, Ghee, Dahi)."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="product-name">Name</Label>
            <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-unit">Unit</Label>
              <Input
                id="product-unit"
                placeholder="Litre, Kg…"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-rate">Default rate</Label>
              <Input
                id="product-rate"
                type="number"
                min="0"
                step="0.01"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="product-billing-type">Billing type</Label>
            <Select
              value={billingType}
              onValueChange={(value) => setBillingType(value as ProductBillingType)}
            >
              <SelectTrigger id="product-billing-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="milk">Milk (daily × days + extra − less)</SelectItem>
                <SelectItem value="simple">Simple (quantity × rate)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {product ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
