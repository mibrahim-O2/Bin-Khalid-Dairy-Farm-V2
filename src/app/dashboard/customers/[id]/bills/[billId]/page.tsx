"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { ArrowLeft, Trash2 } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { calculateDays, calculateLineTotals, calculateSubtotal } from "@/lib/billing";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBillPaymentStatus, type Bill, type BillLineItem, type BillPaymentStatus, type BillStatus } from "@/types/bill";
import type { Customer, CustomerRate, Product } from "@/types/customer";
import { finalizeBill } from "../actions";
import { VoidBillDialog } from "./void-bill-dialog";

const statusVariant: Record<BillStatus, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  finalized: "default",
  void: "destructive",
};

// Matches DESIGN.md's financial status colors: Paid = success green,
// Partially Paid = warning gold-orange, Unpaid = neutral outline.
const paymentStatusClassName: Record<BillPaymentStatus, string> = {
  unpaid: "",
  partial: "border-transparent bg-warning text-warning-foreground",
  paid: "border-transparent bg-success text-success-foreground",
};

const paymentStatusLabel: Record<BillPaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partially Paid",
  paid: "Paid",
};

export default function BillDetailPage() {
  const params = useParams<{ id: string; billId: string }>();
  const { id: customerId, billId } = params;
  // The dashboard layout's server-side auth check doesn't mean the Firebase
  // client SDK's own auth state has attached yet on this page load — direct
  // client Firestore reads (all the onSnapshot calls below) need it too, or
  // they can lose a race against auth rehydration and fail with
  // permission-denied on a fresh page load (e.g. a hard refresh). Wait for
  // it before subscribing to anything.
  const { user } = useCurrentUser();

  const [bill, setBill] = useState<Bill | null | undefined>(undefined);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [rates, setRates] = useState<Record<string, CustomerRate>>({});

  // Local editable draft — initialized once per bill id, not re-synced on
  // every snapshot, so it doesn't clobber in-progress edits.
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lineItems, setLineItems] = useState<BillLineItem[]>([]);
  const [note, setNote] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");

  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    return onSnapshot(
      doc(db, "bills", billId),
      (snap) => {
        setBill(snap.exists() ? ({ id: snap.id, ...snap.data() } as Bill) : null);
      },
      () => setError("Failed to load this bill. Try refreshing the page.")
    );
  }, [billId, user]);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    return onSnapshot(
      doc(db, "customers", customerId),
      (snap) => {
        setCustomer(snap.exists() ? ({ id: snap.id, ...snap.data() } as Customer) : null);
      },
      () => setError("Failed to load the customer. Try refreshing the page.")
    );
  }, [customerId, user]);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const productsQuery = query(
      collection(db, "products"),
      where("active", "==", true),
      orderBy("name")
    );
    return onSnapshot(
      productsQuery,
      (snapshot) => {
        setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product));
      },
      () => setError("Failed to load products. Try refreshing the page.")
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const ratesQuery = query(collection(db, "customerRates"), where("customerId", "==", customerId));
    return onSnapshot(
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
  }, [customerId, user]);

  // Initialize the local editable copy once we first load this bill.
  useEffect(() => {
    if (bill) {
      setStartDate(bill.startDate);
      setEndDate(bill.endDate);
      setLineItems(bill.lineItems);
      setNote(bill.note ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.id]);

  const days = useMemo(
    () => (startDate && endDate ? calculateDays(startDate, endDate) : 0),
    [startDate, endDate]
  );

  const computedLines = useMemo(
    () => lineItems.map((line) => ({ ...line, ...calculateLineTotals(line, days) })),
    [lineItems, days]
  );

  const subtotal = useMemo(
    () => calculateSubtotal(computedLines.map((line) => line.lineTotal)),
    [computedLines]
  );

  const availableProducts = products.filter(
    (product) => !lineItems.some((line) => line.productId === product.id)
  );

  function addLineItem() {
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;
    const rate = rates[product.id]?.rate ?? product.defaultRate;
    const newLine: BillLineItem =
      product.billingType === "milk"
        ? {
            productId: product.id,
            productName: product.name,
            unit: product.unit,
            billingType: "milk",
            rate,
            dailyQty: 0,
            extra: 0,
            less: 0,
            totalQty: 0,
            lineTotal: 0,
          }
        : {
            productId: product.id,
            productName: product.name,
            unit: product.unit,
            billingType: "simple",
            rate,
            quantity: 0,
            totalQty: 0,
            lineTotal: 0,
          };
    setLineItems((current) => [...current, newLine]);
    setSelectedProductId("");
  }

  function updateLine(index: number, patch: Partial<BillLineItem>) {
    setLineItems((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  }

  function removeLine(index: number) {
    setLineItems((current) => current.filter((_, i) => i !== index));
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "bills", billId), {
        startDate,
        endDate,
        days,
        lineItems: computedLines,
        subtotal,
        note: note.trim() || null,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setError("Failed to save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    setError(null);
    // Save the latest edits first so the server recomputes from current inputs.
    await handleSaveDraft();
    const result = await finalizeBill({ billId });
    setFinalizing(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  if (bill === undefined || customer === null) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (bill === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">Bill not found.</p>
        <Link
          href={`/dashboard/customers/${customerId}`}
          className="text-sm text-primary hover:underline"
        >
          Back to {customer?.name ?? "customer"}
        </Link>
      </div>
    );
  }

  const isDraft = bill.status === "draft";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/customers/${customerId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {customer.name}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {bill.billNumber ?? "Draft bill"}
          </h1>
          <Badge variant={statusVariant[bill.status]} className="capitalize">
            {bill.status}
          </Badge>
          {bill.status === "finalized" ? (
            <Badge className={paymentStatusClassName[getBillPaymentStatus(bill)]}>
              {paymentStatusLabel[getBillPaymentStatus(bill)]}
            </Badge>
          ) : null}
        </div>
        {bill.replacesBillId ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Replaces{" "}
            <Link
              href={`/dashboard/customers/${customerId}/bills/${bill.replacesBillId}`}
              className="text-primary hover:underline"
            >
              a voided bill
            </Link>
            .
          </p>
        ) : null}
        {bill.replacedByBillId ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Replaced by{" "}
            <Link
              href={`/dashboard/customers/${customerId}/bills/${bill.replacedByBillId}`}
              className="text-primary hover:underline"
            >
              a new draft
            </Link>
            .
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing period</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="start-date">Start date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              disabled={!isDraft}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="end-date">End date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              disabled={!isDraft}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Days</Label>
            <p className="flex h-8 items-center text-sm text-muted-foreground">
              {isDraft ? days : bill.days} (auto-calculated)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isDraft ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="add-product">Add product</Label>
                <Select value={selectedProductId} onValueChange={(value) => setSelectedProductId(value ?? "")}>
                  <SelectTrigger id="add-product" className="w-48">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" disabled={!selectedProductId} onClick={addLineItem}>
                Add line
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Quantity inputs</TableHead>
                  <TableHead>Total qty</TableHead>
                  <TableHead>Line total</TableHead>
                  {isDraft ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {computedLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isDraft ? 6 : 5} className="text-center text-muted-foreground">
                      No line items yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  computedLines.map((line, index) => (
                    <TableRow key={line.productId}>
                      <TableCell className="font-medium text-foreground">
                        {line.productName}
                        <span className="ml-1 text-xs text-muted-foreground">/{line.unit}</span>
                      </TableCell>
                      <TableCell>
                        {isDraft ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.rate}
                            className="w-24"
                            onChange={(e) =>
                              updateLine(index, { rate: Number(e.target.value) || 0 })
                            }
                          />
                        ) : (
                          line.rate
                        )}
                      </TableCell>
                      <TableCell>
                        {line.billingType === "milk" ? (
                          isDraft ? (
                            <div className="flex gap-2">
                              <div className="flex flex-col gap-1">
                                <Label className="text-[10px] font-normal text-muted-foreground">
                                  Daily Qty
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  aria-label="Daily quantity"
                                  value={line.dailyQty ?? 0}
                                  className="w-20"
                                  onChange={(e) =>
                                    updateLine(index, { dailyQty: Number(e.target.value) || 0 })
                                  }
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <Label className="text-[10px] font-normal text-muted-foreground">
                                  Extra
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  aria-label="Extra"
                                  value={line.extra ?? 0}
                                  className="w-20"
                                  onChange={(e) =>
                                    updateLine(index, { extra: Number(e.target.value) || 0 })
                                  }
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <Label className="text-[10px] font-normal text-muted-foreground">
                                  Less/Used
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  aria-label="Less/used quantity"
                                  value={line.less ?? 0}
                                  className="w-20"
                                  onChange={(e) =>
                                    updateLine(index, { less: Number(e.target.value) || 0 })
                                  }
                                />
                              </div>
                            </div>
                          ) : (
                            `Daily ${line.dailyQty}, +${line.extra ?? 0}, −${line.less ?? 0}`
                          )
                        ) : isDraft ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label="Quantity"
                            value={line.quantity ?? 0}
                            className="w-24"
                            onChange={(e) =>
                              updateLine(index, { quantity: Number(e.target.value) || 0 })
                            }
                          />
                        ) : (
                          line.quantity
                        )}
                      </TableCell>
                      <TableCell>{line.totalQty}</TableCell>
                      <TableCell>{formatAmount(line.lineTotal)}</TableCell>
                      {isDraft ? (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLine(index)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={note}
              disabled={!isDraft}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium text-foreground">
              {formatAmount(isDraft ? subtotal : bill.subtotal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {isDraft ? "Current balance (preview)" : "Previous balance"}
            </span>
            <span className="font-medium text-foreground">
              {formatAmount(isDraft ? customer.balance : (bill.previousBalance ?? 0))}
            </span>
          </div>
          {!isDraft ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount paid</span>
              <span className="font-medium text-success">{formatAmount(bill.amountPaid)}</span>
            </div>
          ) : null}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base">
            <span className="font-medium text-foreground">Total payable</span>
            <span className="font-heading font-bold text-foreground">
              {formatAmount(
                isDraft ? subtotal + customer.balance : (bill.totalPayable ?? bill.subtotal)
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {bill.status === "void" ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium text-foreground">Voided</p>
            <p className="mt-1 text-muted-foreground">
              {bill.voidedAt ? formatDate(bill.voidedAt) : null} — {bill.voidReason}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {isDraft ? (
          <>
            <Button variant="outline" disabled={saving} onClick={handleSaveDraft}>
              Save draft
            </Button>
            <Button disabled={finalizing || computedLines.length === 0} onClick={handleFinalize}>
              Finalize bill
            </Button>
          </>
        ) : null}
        {bill.status === "finalized" ? (
          <VoidBillDialog billId={bill.id} customerId={customerId} />
        ) : null}
      </div>
    </div>
  );
}
