"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import { calculateLeaveDays, calculateLeaveDeduction } from "@/lib/employee-leave";
import { getCurrentSalary, type EmployeeSalaryHistoryEntry } from "@/types/employee-salary";
import type { Employee } from "@/types/employee";
import type { EmployeeLeave } from "@/types/employee-leave";
import {
  deleteEmployeeLeave,
  recordEmployeeLeave,
  recordEmployeeLeaveResume,
  updateEmployeeLeave,
} from "./actions";

type Row = {
  employee: Employee;
  leave: EmployeeLeave | null;
};

export function EmployeeRecordTable({
  employees,
  leaves,
  salaryHistory,
  isOwner,
}: {
  employees: Employee[];
  leaves: EmployeeLeave[];
  salaryHistory: EmployeeSalaryHistoryEntry[];
  isOwner: boolean;
}) {
  const salaryByEmployee = useMemo(() => {
    const map = new Map<string, EmployeeSalaryHistoryEntry[]>();
    for (const entry of salaryHistory) {
      const list = map.get(entry.employeeId) ?? [];
      list.push(entry);
      map.set(entry.employeeId, list);
    }
    return map;
  }, [salaryHistory]);

  const rows: Row[] = useMemo(() => {
    const leavesByEmployee = new Map<string, EmployeeLeave[]>();
    for (const leave of leaves) {
      const list = leavesByEmployee.get(leave.employeeId) ?? [];
      list.push(leave);
      leavesByEmployee.set(leave.employeeId, list);
    }
    return employees.flatMap((employee): Row[] => {
      const employeeLeaves = leavesByEmployee.get(employee.id) ?? [];
      if (employeeLeaves.length === 0) {
        return [{ employee, leave: null }];
      }
      return employeeLeaves.map((leave) => ({ employee, leave }));
    });
  }, [employees, leaves]);

  const computedRows = useMemo(
    () =>
      rows.map((row) => {
        const leaveDays =
          row.leave?.resumeDate != null ? calculateLeaveDays(row.leave.leaveStartDate, row.leave.resumeDate) : null;
        const amountDeducted =
          leaveDays !== null && row.leave ? calculateLeaveDeduction(row.leave.dailyRateAtLeave, leaveDays) : null;
        const hasOpenLeave = row.leave !== null && row.leave.resumeDate === null;
        const currentSalary = getCurrentSalary(salaryByEmployee.get(row.employee.id) ?? []);
        return { ...row, leaveDays, amountDeducted, hasOpenLeave, currentSalary };
      }),
    [rows, salaryByEmployee]
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Desktop: real table (8 columns). Mobile: one card per row — same
          dual-layout pattern as the Milk Record module. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Joining Date</TableHead>
              <TableHead className="text-right">Total Salary</TableHead>
              <TableHead>Leave Start</TableHead>
              <TableHead>Resume</TableHead>
              <TableHead className="text-right">Total Leave Days</TableHead>
              <TableHead className="text-right">Amount Deducted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {computedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No active employees yet.
                </TableCell>
              </TableRow>
            ) : (
              computedRows.map((row) => (
                <TableRow key={row.leave?.id ?? row.employee.id}>
                  <TableCell className="font-medium text-foreground">{row.employee.name}</TableCell>
                  <TableCell>{row.employee.joiningDate ? formatDate(row.employee.joiningDate) : "—"}</TableCell>
                  <TableCell className="text-right">
                    {row.currentSalary ? formatAmount(row.currentSalary.monthlySalary) : "—"}
                  </TableCell>
                  <TableCell>{row.leave ? formatDate(row.leave.leaveStartDate) : "—"}</TableCell>
                  <TableCell>
                    {row.leave?.resumeDate ? formatDate(row.leave.resumeDate) : row.hasOpenLeave ? "Pending" : "—"}
                  </TableCell>
                  <TableCell className="text-right">{row.leaveDays ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {row.amountDeducted !== null ? formatAmount(row.amountDeducted) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {row.hasOpenLeave && row.leave ? <ResumeLeaveDialog leave={row.leave} /> : null}
                      {!row.hasOpenLeave ? <AddLeaveDialog employeeId={row.employee.id} employeeName={row.employee.name} /> : null}
                      {row.leave ? <EditLeaveDialog leave={row.leave} /> : null}
                      {row.leave && isOwner ? <DeleteLeaveDialog leaveId={row.leave.id} /> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {computedRows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No active employees yet.</p>
        ) : (
          computedRows.map((row) => (
            <div
              key={row.leave?.id ?? row.employee.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{row.employee.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Joined {row.employee.joiningDate ? formatDate(row.employee.joiningDate) : "—"}
                  </p>
                </div>
                <p className="text-right text-sm text-muted-foreground">
                  {row.currentSalary ? formatAmount(row.currentSalary.monthlySalary) : "—"}/mo
                </p>
              </div>
              {row.leave ? (
                <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                  <p>
                    Leave {formatDate(row.leave.leaveStartDate)} &middot; Resume{" "}
                    {row.leave.resumeDate ? formatDate(row.leave.resumeDate) : row.hasOpenLeave ? "Pending" : "—"}
                  </p>
                  {row.leaveDays !== null ? (
                    <p>
                      {row.leaveDays} day{row.leaveDays === 1 ? "" : "s"} &middot; Deducted{" "}
                      {row.amountDeducted !== null ? formatAmount(row.amountDeducted) : "—"}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                {row.hasOpenLeave && row.leave ? <ResumeLeaveDialog leave={row.leave} /> : null}
                {!row.hasOpenLeave ? <AddLeaveDialog employeeId={row.employee.id} employeeName={row.employee.name} /> : null}
                {row.leave ? <EditLeaveDialog leave={row.leave} /> : null}
                {row.leave && isOwner ? <DeleteLeaveDialog leaveId={row.leave.id} /> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddLeaveDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await recordEmployeeLeave({ employeeId, leaveStartDate, note: note.trim() || undefined });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setLeaveStartDate("");
    setNote("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger
        render={
          <Button variant="outline" size="icon-sm" aria-label={`Add leave for ${employeeName}`}>
            <Plus className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record leave for {employeeName}</DialogTitle>
          <DialogDescription>
            Enter the date they went on leave. You can fill in the resume date later.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-start-date">Leave start date</Label>
            <Input
              id="leave-start-date"
              type="date"
              value={leaveStartDate}
              onChange={(e) => setLeaveStartDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-note">Note (optional)</Label>
            <Textarea id="leave-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving || !leaveStartDate}>
              Record leave
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResumeLeaveDialog({ leave }: { leave: EmployeeLeave }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resumeDate, setResumeDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await recordEmployeeLeaveResume({ leaveId: leave.id, resumeDate });
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
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger render={<Button variant="outline" size="sm">Resume</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record resume date</DialogTitle>
          <DialogDescription>
            On leave since {formatDate(leave.leaveStartDate)}. Enter the date they came back to work.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resume-date">Resume date</Label>
            <Input
              id="resume-date"
              type="date"
              min={leave.leaveStartDate}
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

function EditLeaveDialog({ leave }: { leave: EmployeeLeave }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaveStartDate, setLeaveStartDate] = useState(leave.leaveStartDate);
  const [resumeDate, setResumeDate] = useState(leave.resumeDate ?? "");
  const [note, setNote] = useState(leave.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await updateEmployeeLeave({
      leaveId: leave.id,
      leaveStartDate,
      resumeDate: resumeDate || undefined,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setLeaveStartDate(leave.leaveStartDate);
          setResumeDate(leave.resumeDate ?? "");
          setNote(leave.note ?? "");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit leave record</DialogTitle>
          <DialogDescription>
            Corrects the dates/note only — the daily rate used for the deduction stays whatever it
            was when this leave was first recorded.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-leave-start">Leave start date</Label>
              <Input
                id="edit-leave-start"
                type="date"
                value={leaveStartDate}
                onChange={(e) => setLeaveStartDate(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-leave-resume">Resume date</Label>
              <Input
                id="edit-leave-resume"
                type="date"
                min={leaveStartDate}
                value={resumeDate}
                onChange={(e) => setResumeDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-leave-note">Note (optional)</Label>
            <Textarea id="edit-leave-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving || !leaveStartDate}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLeaveDialog({ leaveId }: { leaveId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    const result = await deleteEmployeeLeave({ leaveId });
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
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Delete leave record"><Trash2 className="size-4" /></Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this leave record?</DialogTitle>
          <DialogDescription>
            This permanently removes it from the database. If its deduction was already applied to
            a salary accrual, that accrual keeps its own recorded figures — only this leave record
            itself is deleted. This cannot be undone.
          </DialogDescription>
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
