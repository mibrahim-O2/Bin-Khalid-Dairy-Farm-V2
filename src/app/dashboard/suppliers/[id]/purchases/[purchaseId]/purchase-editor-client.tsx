"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { calculateLineTotal, calculateSubtotal } from "@/lib/purchasing";
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
import {
  getPurchasePaymentStatus,
  type Purchase,
  type PurchaseLineItem,
  type PurchasePaymentStatus,
  type PurchaseStatus,
} from "@/types/purchase";
import type { FarmSupplyItem, Supplier } from "@/types/supplier";
import { finalizePurchase, updateDraftPurchase, updateFinalizedPurchase } from "../actions";
import { DeletePurchaseDialog } from "./delete-purchase-dialog";

const statusVariant: Record<PurchaseStatus, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  finalized: "default",
  void: "destructive",
};

const paymentStatusClassName: Record<PurchasePaymentStatus, string> = {
  unpaid: "",
  partial: "border-transparent bg-warning text-warning-foreground",
  paid: "border-transparent bg-success text-success-foreground",
};

const paymentStatusLabel: Record<PurchasePaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partially Paid",
  paid: "Paid",
};

export function PurchaseEditorClient({
  supplierId,
  purchase,
  supplier,
  items,
  isOwner,
}: {
  supplierId: string;
  purchase: Purchase | null;
  supplier: Supplier | null;
  items: FarmSupplyItem[];
  isOwner: boolean;
}) {
  const router = useRouter();

  const [purchaseDate, setPurchaseDate] = useState(purchase?.purchaseDate ?? "");
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>(purchase?.lineItems ?? []);
  const [note, setNote] = useState(purchase?.note ?? "");
  const [selectedItemId, setSelectedItemId] = useState("");
  // Owner-only correction mode for an already-finalized purchase — see
  // updateFinalizedPurchase's doc comment. Off by default even for the
  // Owner, so a finalized purchase still reads as read-only at a glance.
  const [ownerEditing, setOwnerEditing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computedLines = useMemo(
    () => lineItems.map((line) => ({ ...line, lineTotal: calculateLineTotal(line) })),
    [lineItems]
  );
  const subtotal = useMemo(
    () => calculateSubtotal(computedLines.map((line) => line.lineTotal)),
    [computedLines]
  );

  const availableItems = items.filter((item) => !lineItems.some((line) => line.itemId === item.id));

  function addLineItem() {
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) return;
    const newLine: PurchaseLineItem = {
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      rate: item.defaultRate,
      quantity: 0,
      lineTotal: 0,
    };
    setLineItems((current) => [...current, newLine]);
    setSelectedItemId("");
  }

  function updateLine(index: number, patch: Partial<PurchaseLineItem>) {
    setLineItems((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLineItems((current) => current.filter((_, i) => i !== index));
  }

  async function handleSaveDraft(): Promise<boolean> {
    if (!purchase) return false;
    setSaving(true);
    setError(null);
    const result = await updateDraftPurchase({
      purchaseId: purchase.id,
      purchaseDate,
      lineItems: computedLines.map(({ itemId, itemName, unit, rate, quantity }) => ({
        itemId,
        itemName,
        unit,
        rate,
        quantity,
      })),
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleFinalize() {
    if (!purchase) return;
    setFinalizing(true);
    setError(null);
    const saved = await handleSaveDraft();
    if (!saved) {
      setFinalizing(false);
      return;
    }
    const result = await finalizePurchase({ purchaseId: purchase.id });
    setFinalizing(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Lands in the Supplier Ledger, not back on this page — there's no
    // separate Purchases list anymore, and the ledger is where this
    // purchase now shows up alongside everything else.
    router.push(`/dashboard/suppliers/${supplierId}/ledger`);
  }

  async function handleSaveFinalizedEdit() {
    if (!purchase) return;
    setSaving(true);
    setError(null);
    const result = await updateFinalizedPurchase({
      purchaseId: purchase.id,
      purchaseDate,
      lineItems: computedLines.map(({ itemId, itemName, unit, rate, quantity }) => ({
        itemId,
        itemName,
        unit,
        rate,
        quantity,
      })),
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOwnerEditing(false);
    router.refresh();
  }

  if (purchase === null || supplier === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">Purchase not found.</p>
        <Link
          href={`/dashboard/suppliers/${supplierId}`}
          className="text-sm text-primary hover:underline"
        >
          Back to {supplier?.name ?? "supplier"}
        </Link>
      </div>
    );
  }

  const isDraft = purchase.status === "draft";
  // Owner-only correction of an already-finalized purchase reuses this
  // same draft-editing UI — see ownerEditing's declaration above.
  const isEditable = isDraft || ownerEditing;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/suppliers/${supplierId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {supplier.name}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-foreground">Purchase</h1>
          <Badge variant={statusVariant[purchase.status]} className="capitalize">
            {purchase.status}
          </Badge>
          {purchase.status === "finalized" ? (
            <Badge className={paymentStatusClassName[getPurchasePaymentStatus(purchase)]}>
              {paymentStatusLabel[getPurchasePaymentStatus(purchase)]}
            </Badge>
          ) : null}
        </div>
        {purchase.replacesPurchaseId ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Replaces{" "}
            <Link
              href={`/dashboard/suppliers/${supplierId}/purchases/${purchase.replacesPurchaseId}`}
              className="text-primary hover:underline"
            >
              a voided purchase
            </Link>
            .
          </p>
        ) : null}
        {purchase.replacedByPurchaseId ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Replaced by{" "}
            <Link
              href={`/dashboard/suppliers/${supplierId}/purchases/${purchase.replacedByPurchaseId}`}
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
          <CardTitle>Purchase date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-xs flex-col gap-2">
            <Label htmlFor="purchase-date">Date</Label>
            <Input
              id="purchase-date"
              type="date"
              value={purchaseDate}
              disabled={!isEditable}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isEditable ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="add-item">Add item</Label>
                <Select value={selectedItemId} onValueChange={(value) => setSelectedItemId(value ?? "")}>
                  <SelectTrigger id="add-item" className="w-56">
                    <SelectValue placeholder="Select a farm supply item" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" disabled={!selectedItemId} onClick={addLineItem}>
                Add line
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Line total</TableHead>
                  {isEditable ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {computedLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isEditable ? 5 : 4} className="text-center text-muted-foreground">
                      No line items yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  computedLines.map((line, index) => (
                    <TableRow key={line.itemId}>
                      <TableCell className="font-medium text-foreground">
                        {line.itemName}
                        <span className="ml-1 text-xs text-muted-foreground">/{line.unit}</span>
                      </TableCell>
                      <TableCell>
                        {isEditable ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.rate}
                            className="w-24"
                            aria-label="Rate"
                            onChange={(e) => updateLine(index, { rate: Number(e.target.value) || 0 })}
                          />
                        ) : (
                          line.rate
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditable ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.quantity}
                            className="w-24"
                            aria-label="Quantity"
                            onChange={(e) =>
                              updateLine(index, { quantity: Number(e.target.value) || 0 })
                            }
                          />
                        ) : (
                          line.quantity
                        )}
                      </TableCell>
                      <TableCell>{formatAmount(line.lineTotal)}</TableCell>
                      {isEditable ? (
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
              disabled={!isEditable}
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
            <span className="text-muted-foreground">Subtotal{ownerEditing ? " (preview)" : ""}</span>
            <span className="font-medium text-foreground">
              {formatAmount(isEditable ? subtotal : purchase.subtotal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {isDraft ? "Current balance (preview)" : "Previous balance"}
            </span>
            <span className="font-medium text-foreground">
              {formatAmount(isDraft ? supplier.balance : (purchase.previousBalance ?? 0))}
            </span>
          </div>
          {!isDraft ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount paid</span>
              <span className="font-medium text-success">{formatAmount(purchase.amountPaid ?? 0)}</span>
            </div>
          ) : null}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base">
            <span className="font-medium text-foreground">Total payable{ownerEditing ? " (preview)" : ""}</span>
            <span className="font-heading font-bold text-foreground">
              {formatAmount(
                isDraft
                  ? subtotal + supplier.balance
                  : ownerEditing
                    ? subtotal + (purchase.previousBalance ?? 0)
                    : (purchase.totalPayable ?? purchase.subtotal)
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {purchase.status === "void" ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium text-foreground">Voided</p>
            <p className="mt-1 text-muted-foreground">
              {purchase.voidedAt ? formatDate(purchase.voidedAt) : null} — {purchase.voidReason}
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
              Save Purchase
            </Button>
          </>
        ) : null}
        {purchase.status === "finalized" && isOwner ? (
          ownerEditing ? (
            <>
              <Button variant="outline" disabled={saving} onClick={() => setOwnerEditing(false)}>
                Cancel
              </Button>
              <Button disabled={saving || computedLines.length === 0} onClick={handleSaveFinalizedEdit}>
                Save changes
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setOwnerEditing(true)}>
              Edit
            </Button>
          )
        ) : null}
        {purchase.status === "finalized" && isOwner ? (
          <DeletePurchaseDialog purchaseId={purchase.id} supplierId={supplierId} />
        ) : null}
      </div>
    </div>
  );
}
