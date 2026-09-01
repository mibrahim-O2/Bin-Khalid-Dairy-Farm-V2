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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CustomerRate, Product } from "@/types/customer";
import { setCustomerRate } from "./rate-actions";

function RateEditDialog({
  customerId,
  product,
  currentRate,
}: {
  customerId: string;
  product: Product;
  currentRate: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(String(currentRate ?? product.defaultRate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRate(String(currentRate ?? product.defaultRate));
      setError(null);
    }
  }, [open, currentRate, product.defaultRate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const newRate = Number(rate);
    if (!Number.isFinite(newRate) || newRate < 0) {
      setError("Enter a valid non-negative rate.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await setCustomerRate({ customerId, productId: product.id, rate: newRate });
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
      <DialogTrigger render={<Button variant="outline" size="sm">Set rate</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.name} rate</DialogTitle>
          <DialogDescription>
            The previous rate is kept in history — it never affects bills already finalized.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rate-value">Rate per {product.unit}</Label>
            <Input
              id="rate-value"
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Save rate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RateManager({
  customerId,
  products,
  rates,
}: {
  customerId: string;
  products: Product[];
  rates: CustomerRate[];
}) {
  const ratesByProductId: Record<string, CustomerRate> = {};
  for (const rate of rates) ratesByProductId[rate.productId] = rate;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No active products yet — add some on the Products page first.
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => {
              const rate = ratesByProductId[product.id];
              return (
                <TableRow key={product.id}>
                  <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell>
                    {rate ? rate.rate : `${product.defaultRate} (default)`}
                  </TableCell>
                  <TableCell className="text-right">
                    <RateEditDialog
                      customerId={customerId}
                      product={product}
                      currentRate={rate?.rate ?? null}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
