"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
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

function RateEditDialog({
  customerId,
  product,
  currentRate,
}: {
  customerId: string;
  product: Product;
  currentRate: number | null;
}) {
  const { user } = useCurrentUser();
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
    if (!user) {
      setError("Still loading your session — try again in a moment.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const rateRef = doc(db, "customerRates", `${customerId}_${product.id}`);
      const now = new Date().toISOString();
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(rateRef);
        if (snap.exists()) {
          // Move the outgoing rate into history before overwriting it —
          // rate changes are historized, never silently overwritten.
          const previous = snap.data();
          const historyRef = doc(collection(rateRef, "history"));
          tx.set(historyRef, {
            rate: previous.rate,
            supersededAt: now,
            updatedBy: previous.updatedBy ?? null,
          });
        }
        tx.set(rateRef, {
          customerId,
          productId: product.id,
          rate: newRate,
          updatedAt: now,
          updatedBy: user.uid,
        });
      });
      setOpen(false);
    } catch {
      setError("Failed to save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
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

export function RateManager({ customerId }: { customerId: string }) {
  // Wait for the Firebase client SDK's own auth state — otherwise these can
  // lose a race against auth rehydration on a fresh page load and fail with
  // permission-denied (and silently leave rates empty, so bills would fall
  // back to a product's default rate instead of this customer's real one).
  const { user } = useCurrentUser();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [rates, setRates] = useState<Record<string, CustomerRate>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const productsQuery = query(
      collection(db, "products"),
      where("active", "==", true),
      orderBy("name")
    );
    const unsubProducts = onSnapshot(
      productsQuery,
      (snapshot) => {
        setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product));
      },
      () => setError("Failed to load products. Try refreshing the page.")
    );

    const ratesQuery = query(collection(db, "customerRates"), where("customerId", "==", customerId));
    const unsubRates = onSnapshot(
      ratesQuery,
      (snapshot) => {
        const next: Record<string, CustomerRate> = {};
        for (const d of snapshot.docs) {
          const rate = { id: d.id, ...d.data() } as CustomerRate;
          next[rate.productId] = rate;
        }
        setRates(next);
      },
      () => setError("Failed to load customer rates. Try refreshing the page.")
    );

    return () => {
      unsubProducts();
      unsubRates();
    };
  }, [customerId, user]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

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
          {products === null ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No active products yet — add some on the Products page first.
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => {
              const rate = rates[product.id];
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
