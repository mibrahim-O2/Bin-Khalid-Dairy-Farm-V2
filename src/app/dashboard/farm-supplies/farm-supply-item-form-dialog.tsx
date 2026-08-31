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
import type { FarmSupplyItem } from "@/types/supplier";

type FarmSupplyItemFormDialogProps = {
  item?: FarmSupplyItem;
  trigger: React.ReactElement;
};

export function FarmSupplyItemFormDialog({ item, trigger }: FarmSupplyItemFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [defaultRate, setDefaultRate] = useState(item ? String(item.defaultRate) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setUnit(item?.unit ?? "");
      setDefaultRate(item ? String(item.defaultRate) : "");
      setError(null);
    }
  }, [open, item]);

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
      if (item) {
        await updateDoc(doc(db, "farmSupplyItems", item.id), {
          name: name.trim(),
          unit: unit.trim(),
          defaultRate: rate,
          updatedAt: now,
        });
      } else {
        await addDoc(collection(db, "farmSupplyItems"), {
          name: name.trim(),
          unit: unit.trim(),
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
          <DialogTitle>{item ? "Edit farm supply item" : "Add farm supply item"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Update this item's details."
              : "Materials bought from suppliers (e.g. feed, medicine, fodder)."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-name">Name</Label>
            <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-unit">Unit</Label>
              <Input
                id="item-unit"
                placeholder="Kg, Bag, Litre…"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-rate">Default rate</Label>
              <Input
                id="item-rate"
                type="number"
                min="0"
                step="0.01"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                required
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {item ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
