"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
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

export default function FarmSuppliesPage() {
  const { user } = useCurrentUser();
  const [items, setItems] = useState<FarmSupplyItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const q = query(collection(db, "farmSupplyItems"), orderBy("name"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as FarmSupplyItem));
      },
      () => setError("Failed to load farm supply items. Check your connection.")
    );
    return unsubscribe;
  }, [user]);

  async function toggleActive(item: FarmSupplyItem) {
    const db = getFirebaseDb();
    await updateDoc(doc(db, "farmSupplyItems", item.id), {
      active: !item.active,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Farm Supplies</h1>
          <p className="text-sm text-muted-foreground">Materials bought from suppliers.</p>
        </div>
        <FarmSupplyItemFormDialog trigger={<Button>Add item</Button>} />
      </div>

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
                {items === null ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
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
                        <Button variant="outline" size="sm" onClick={() => toggleActive(item)}>
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
    </div>
  );
}
