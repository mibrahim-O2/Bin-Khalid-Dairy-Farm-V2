"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { setFarmSupplyItemActive } from "./actions";

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
