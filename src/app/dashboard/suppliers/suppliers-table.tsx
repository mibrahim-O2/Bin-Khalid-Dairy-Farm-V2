"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Supplier } from "@/types/supplier";
import { formatAmount } from "@/lib/format-number";
import { SupplierFormDialog } from "./supplier-form-dialog";
import { setSupplierActive } from "./crud-actions";

export function SuppliersTable({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(term) || (s.phone ?? "").toLowerCase().includes(term)
    );
  }, [suppliers, search]);

  async function toggleActive(supplier: Supplier) {
    setPendingId(supplier.id);
    setError(null);
    const result = await setSupplierActive({ supplierId: supplier.id, active: !supplier.active });
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground">{suppliers.length} total</p>
        </div>
        <SupplierFormDialog
          trigger={<Button>Add supplier</Button>}
          onCreated={(id) => router.push(`/dashboard/suppliers/${id}`)}
        />
      </div>

      <Input
        placeholder="Search by name or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

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
                  <TableHead>Phone</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No suppliers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium text-foreground">
                        <Link href={`/dashboard/suppliers/${supplier.id}`} className="hover:underline">
                          {supplier.name}
                        </Link>
                      </TableCell>
                      <TableCell>{supplier.phone ?? "—"}</TableCell>
                      <TableCell
                        className={
                          supplier.balance > 0
                            ? "text-foreground"
                            : supplier.balance < 0
                              ? "text-success"
                              : "text-muted-foreground"
                        }
                      >
                        {formatAmount(supplier.balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={supplier.active ? "default" : "secondary"}>
                          {supplier.active ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingId === supplier.id}
                          onClick={() => toggleActive(supplier)}
                        >
                          {supplier.active ? "Archive" : "Unarchive"}
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
