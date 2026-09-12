"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent } from "@/components/ui/card";
import type { FarmSupplyItem } from "@/types/supplier";
import { FarmSupplyItemFormDialog } from "./farm-supply-item-form-dialog";
import { deleteFarmSupplyItem, setFarmSupplyItemActive } from "./actions";

function DeleteFarmSupplyItemDialog({ item, onDeleted }: { item: FarmSupplyItem; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    const result = await deleteFarmSupplyItem({ itemId: item.id });
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    onDeleted();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger render={<Button variant="destructive" size="sm">Delete</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {item.name}?</DialogTitle>
          <DialogDescription>
            This permanently removes the item. It only succeeds if it&apos;s never been used in a
            purchase — if it has, archive it instead.
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

export function FarmSuppliesTable({ items }: { items: FarmSupplyItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(item: FarmSupplyItem) {
    setPendingId(item.id);
    setError(null);
    const result = await setFarmSupplyItemActive({ itemId: item.id, active: !item.active });
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Default rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No items yet. Add your first one, or run{" "}
                      <code>node scripts/seed-farm-supplies.mjs</code> to pre-seed common items.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.defaultRate}</TableCell>
                      <TableCell>
                        <Badge variant={item.active ? "default" : "secondary"}>
                          {item.active ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex justify-end gap-2 text-right">
                        <FarmSupplyItemFormDialog
                          item={item}
                          trigger={
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingId === item.id}
                          onClick={() => toggleActive(item)}
                        >
                          {item.active ? "Archive" : "Unarchive"}
                        </Button>
                        <DeleteFarmSupplyItemDialog item={item} onDeleted={() => router.refresh()} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
