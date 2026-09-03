"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format-date";
import type { Customer, CustomerMilkPause } from "@/types/customer";
import { recordMilkPause, recordMilkResume } from "./actions";

/** Whole days between two yyyy-mm-dd strings — UTC-midnight parsing, same
 *  approach as calculateDays() in src/lib/billing.ts, so this can't drift
 *  with server/client timezone differences. Not inclusive of the resume
 *  day itself: pausing on the 1st and resuming on the 5th means 4 days
 *  (1st-4th) were actually missed. */
function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

type Row = {
  customer: Customer;
  pause: CustomerMilkPause | null;
  dailyQty: number | null;
};

export function MilkRecordTable({
  customers,
  pauses,
  dailyQtyByCustomerId,
}: {
  customers: Customer[];
  pauses: CustomerMilkPause[];
  dailyQtyByCustomerId: Record<string, number>;
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
      const dailyQty = dailyQtyByCustomerId[customer.id] ?? null;
      if (customerPauses.length === 0) {
        return [{ customer, pause: null, dailyQty }];
      }
      return customerPauses.map((pause) => ({ customer, pause, dailyQty }));
    });
  }, [customers, pauses, dailyQtyByCustomerId]);

  return (
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
                row.pause?.resumeDate != null ? daysBetween(row.pause.pauseDate, row.pause.resumeDate) : null;
              const milkMissed =
                daysMissed !== null && row.pause?.dailyMilkQtyAtPause != null
                  ? Math.round(daysMissed * row.pause.dailyMilkQtyAtPause * 100) / 100
                  : null;
              const hasOpenPause = row.pause !== null && row.pause.resumeDate === null;

              return (
                <TableRow key={row.pause?.id ?? row.customer.id}>
                  <TableCell className="font-medium text-foreground">{row.customer.name}</TableCell>
                  <TableCell>{row.customer.joiningDate ? formatDate(row.customer.joiningDate) : "—"}</TableCell>
                  <TableCell className="text-right">{row.dailyQty ?? "—"}</TableCell>
                  <TableCell>{row.pause ? formatDate(row.pause.pauseDate) : "—"}</TableCell>
                  <TableCell>{row.pause?.resumeDate ? formatDate(row.pause.resumeDate) : hasOpenPause ? "Pending" : "—"}</TableCell>
                  <TableCell className="text-right">{daysMissed ?? "—"}</TableCell>
                  <TableCell className="text-right">{milkMissed ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {hasOpenPause && row.pause ? <ResumeDialog pause={row.pause} /> : null}
                      {!hasOpenPause ? <AddPauseDialog customerId={row.customer.id} customerName={row.customer.name} /> : null}
                    </div>
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

function AddPauseDialog({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pauseDate, setPauseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await recordMilkPause({ customerId, pauseDate });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setPauseDate("");
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
            Enter the date they stopped taking milk. You can fill in the resume date later.
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
