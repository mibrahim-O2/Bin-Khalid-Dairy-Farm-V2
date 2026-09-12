"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format-date";
import { calculateDaysMissed, calculateMilkMissed } from "@/lib/milk-record";
import type { Customer, CustomerExtraMilk, CustomerMilkPause } from "@/types/customer";
import { deleteExtraMilk, deleteMilkPause, recordExtraMilk, recordMilkPause, recordMilkResume } from "./actions";

type Row = {
  customer: Customer;
  pause: CustomerMilkPause | null;
};

export function MilkRecordTable({
  customers,
  pauses,
  extraMilk,
  isOwner,
}: {
  customers: Customer[];
  pauses: CustomerMilkPause[];
  extraMilk: CustomerExtraMilk[];
  isOwner: boolean;
}) {
  const rows: Row[] = useMemo(() => {
    const pausesByCustomer = new Map<string, CustomerMilkPause[]>();
    for (const pause of pauses) {
      const list = pausesByCustomer.get(pause.customerId) ?? [];
      list.push(pause);
      pausesByCustomer.set(pause.customerId, list);
    }
    return customers.flatMap((customer): Row[] => {
      const customerPauses = pausesByCustomer.get(customer.id) ?? [];
      if (customerPauses.length === 0) {
        return [{ customer, pause: null }];
      }
      return customerPauses.map((pause) => ({ customer, pause }));
    });
  }, [customers, pauses]);

  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Joining Date</TableHead>
              <TableHead className="text-right">Daily Milk Qty</TableHead>
              <TableHead>Temporary Pause</TableHead>
              <TableHead>Resume</TableHead>
              <TableHead className="text-right">Days Missed</TableHead>
              <TableHead className="text-right">Milk Missed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No active customers yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const daysMissed =
                  row.pause?.resumeDate != null ? calculateDaysMissed(row.pause.pauseDate, row.pause.resumeDate) : null;
                const milkMissed =
                  daysMissed !== null && row.pause
                    ? calculateMilkMissed(row.pause.dailyMilkQtyAtPause, row.pause.reducedDailyQty, daysMissed)
                    : null;
                const hasOpenPause = row.pause !== null && row.pause.resumeDate === null;

                return (
                  <TableRow key={row.pause?.id ?? row.customer.id}>
                    <TableCell className="font-medium text-foreground">{row.customer.name}</TableCell>
                    <TableCell>{row.customer.joiningDate ? formatDate(row.customer.joiningDate) : "—"}</TableCell>
                    <TableCell className="text-right">{row.customer.dailyMilkQty ?? "—"}</TableCell>
                    <TableCell>{row.pause ? formatDate(row.pause.pauseDate) : "—"}</TableCell>
                    <TableCell>
                      {row.pause?.resumeDate ? formatDate(row.pause.resumeDate) : hasOpenPause ? "Pending" : "—"}
                      {row.pause?.reducedDailyQty != null ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (reduced to {row.pause.reducedDailyQty})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{daysMissed ?? "—"}</TableCell>
                    <TableCell className="text-right">{milkMissed ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {hasOpenPause && row.pause ? <ResumeDialog pause={row.pause} /> : null}
                        {!hasOpenPause ? (
                          <AddPauseDialog
                            customerId={row.customer.id}
                            customerName={row.customer.name}
                            standardDailyMilkQty={row.customer.dailyMilkQty}
                          />
                        ) : null}
                        {row.pause && isOwner ? <DeletePauseDialog pauseId={row.pause.id} /> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ExtraMilkSection customers={customers} customersById={customersById} extraMilk={extraMilk} isOwner={isOwner} />
    </div>
  );
}

function AddPauseDialog({
  customerId,
  customerName,
  standardDailyMilkQty,
}: {
  customerId: string;
  customerName: string;
  standardDailyMilkQty: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pauseDate, setPauseDate] = useState("");
  const [reducedInstead, setReducedInstead] = useState(false);
  const [reducedDailyQty, setReducedDailyQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await recordMilkPause({
      customerId,
      pauseDate,
      reducedDailyQty: reducedInstead && reducedDailyQty !== "" ? Number(reducedDailyQty) : undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setPauseDate("");
    setReducedInstead(false);
    setReducedDailyQty("");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="icon-sm" aria-label={`Add pause for ${customerName}`}>
            <Plus className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a pause for {customerName}</DialogTitle>
          <DialogDescription>
            Enter the date they stopped taking milk (or reduced their quantity). You can fill in
            the resume date later.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pause-date">Pause date</Label>
            <Input
              id="pause-date"
              type="date"
              value={pauseDate}
              onChange={(e) => setPauseDate(e.target.value)}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reducedInstead}
              onChange={(e) => setReducedInstead(e.target.checked)}
            />
            They reduced their quantity instead of stopping entirely
          </label>
          {reducedInstead ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reduced-daily-qty">
                Reduced daily quantity{standardDailyMilkQty != null ? ` (was ${standardDailyMilkQty})` : ""}
              </Label>
              <Input
                id="reduced-daily-qty"
                type="number"
                min="0"
                step="0.01"
                value={reducedDailyQty}
                onChange={(e) => setReducedDailyQty(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving || !pauseDate}>
              Record pause
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResumeDialog({ pause }: { pause: CustomerMilkPause }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resumeDate, setResumeDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await recordMilkResume({ pauseId: pause.id, resumeDate });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setResumeDate("");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Resume</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record resume date</DialogTitle>
          <DialogDescription>
            Paused since {formatDate(pause.pauseDate)}. Enter the date they started taking milk again.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resume-date">Resume date</Label>
            <Input
              id="resume-date"
              type="date"
              min={pause.pauseDate}
              value={resumeDate}
              onChange={(e) => setResumeDate(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving || !resumeDate}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePauseDialog({ pauseId }: { pauseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    const result = await deleteMilkPause({ pauseId });
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Delete pause record"><Trash2 className="size-4" /></Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this pause record?</DialogTitle>
          <DialogDescription>This permanently removes it. This cannot be undone.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="destructive" disabled={deleting} onClick={handleConfirm}>
            Yes, delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtraMilkSection({
  customers,
  customersById,
  extraMilk,
  isOwner,
}: {
  customers: Customer[];
  customersById: Map<string, Customer>;
  extraMilk: CustomerExtraMilk[];
  isOwner: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Extra Milk</CardTitle>
        <AddExtraMilkDialog customers={customers} />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Note</TableHead>
                {isOwner ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {extraMilk.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isOwner ? 5 : 4} className="text-center text-muted-foreground">
                    No extra milk recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                extraMilk.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-foreground">
                      {customersById.get(entry.customerId)?.name ?? "—"}
                    </TableCell>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell className="text-right">{entry.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.note ?? "—"}</TableCell>
                    {isOwner ? (
                      <TableCell className="text-right">
                        <DeleteExtraMilkDialog extraMilkId={entry.id} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AddExtraMilkDialog({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await recordExtraMilk({
      customerId,
      date,
      quantity: Number(quantity),
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setCustomerId("");
    setDate("");
    setQuantity("");
    setNote("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger render={<Button size="sm">Add extra milk</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record extra milk</DialogTitle>
          <DialogDescription>
            Feeds a smart default into the customer&apos;s next bill for the matching period — still
            editable per-bill.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="extra-milk-customer">Customer</Label>
            <select
              id="extra-milk-customer"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="" disabled>
                Select a customer
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="extra-milk-date">Date</Label>
            <Input id="extra-milk-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="extra-milk-quantity">Quantity</Label>
            <Input
              id="extra-milk-quantity"
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="extra-milk-note">Note (optional)</Label>
            <Textarea id="extra-milk-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving || !customerId || !date || !quantity}>
              Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteExtraMilkDialog({ extraMilkId }: { extraMilkId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    const result = await deleteExtraMilk({ extraMilkId });
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Delete extra milk record"><Trash2 className="size-4" /></Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this extra milk record?</DialogTitle>
          <DialogDescription>This permanently removes it. This cannot be undone.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="destructive" disabled={deleting} onClick={handleConfirm}>
            Yes, delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
