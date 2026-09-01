"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import { createFarmSupplyItem, updateFarmSupplyItem } from "./actions";

type FarmSupplyItemFormDialogProps = {
  item?: FarmSupplyItem;
  trigger: React.ReactElement;
};

export function FarmSupplyItemFormDialog({ item, trigger }: FarmSupplyItemFormDialogProps) {
  const router = useRouter();
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
    const result = item
      ? await updateFarmSupplyItem({ itemId: item.id, name, unit, defaultRate: rate })
      : await createFarmSupplyItem({ name, unit, defaultRate: rate });
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
