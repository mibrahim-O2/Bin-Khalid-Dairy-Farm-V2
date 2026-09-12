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
import type { Customer } from "@/types/customer";
import { createCustomer, updateCustomer } from "./crud-actions";

type CustomerFormDialogProps = {
  customer?: Customer;
  trigger: React.ReactElement;
  onCreated?: (customerId: string) => void;
};

export function CustomerFormDialog({ customer, trigger, onCreated }: CustomerFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(customer?.whatsappNumber ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [dailyMilkQty, setDailyMilkQty] = useState(customer?.dailyMilkQty?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(customer?.name ?? "");
      setPhone(customer?.phone ?? "");
      setWhatsappNumber(customer?.whatsappNumber ?? "");
      setAddress(customer?.address ?? "");
      setDailyMilkQty(customer?.dailyMilkQty?.toString() ?? "");
      setError(null);
    }
  }, [open, customer]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    const parsedDailyMilkQty = dailyMilkQty.trim() === "" ? undefined : Number(dailyMilkQty);
    if (parsedDailyMilkQty !== undefined && (!Number.isFinite(parsedDailyMilkQty) || parsedDailyMilkQty < 0)) {
      setError("Enter a valid, non-negative daily milk quantity.");
      return;
    }

    setSaving(true);
    setError(null);
    if (customer) {
      const result = await updateCustomer({
        customerId: customer.id,
        name,
        phone,
        whatsappNumber,
        address,
        dailyMilkQty: parsedDailyMilkQty,
      });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
    } else {
      const result = await createCustomer({ name, phone, whatsappNumber, address, dailyMilkQty: parsedDailyMilkQty });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.customerId) onCreated?.(result.customerId);
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            {customer ? "Update this customer's details." : "Basic details — rates and opening balance are set from the customer's page."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customer-name">Name</Label>
            <Input id="customer-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customer-whatsapp">WhatsApp number</Label>
            <Input
              id="customer-whatsapp"
              type="tel"
              placeholder="Leave blank if same as phone"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customer-daily-milk-qty">Daily Milk Quantity</Label>
            <Input
              id="customer-daily-milk-qty"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 2.5"
              value={dailyMilkQty}
              onChange={(e) => setDailyMilkQty(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customer-address">Address</Label>
            <Textarea
              id="customer-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {customer ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
