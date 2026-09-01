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
import type { Product } from "@/types/customer";
import { ProductFormDialog } from "./product-form-dialog";
import { setProductActive } from "./actions";

export function ProductsTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(product: Product) {
    setPendingId(product.id);
    setError(null);
    const result = await setProductActive({ productId: product.id, active: !product.active });
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
                  <TableHead>Billing type</TableHead>
                  <TableHead>Default rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No products yet. Add your first one, or run{" "}
                      <code>node scripts/seed-products.mjs</code> to pre-seed Milk, Ghee, Dahi,
                      and Makhan.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell className="capitalize">{product.billingType}</TableCell>
                      <TableCell>{product.defaultRate}</TableCell>
                      <TableCell>
                        <Badge variant={product.active ? "default" : "secondary"}>
                          {product.active ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex justify-end gap-2 text-right">
                        <ProductFormDialog
                          product={product}
                          trigger={
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingId === product.id}
                          onClick={() => toggleActive(product)}
                        >
                          {product.active ? "Archive" : "Unarchive"}
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
