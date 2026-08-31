"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Supplier } from "@/types/supplier";
import { formatAmount } from "@/lib/format-number";
import { SupplierFormDialog } from "../supplier-form-dialog";
import { OpeningBalanceCard } from "./opening-balance-card";
import { PurchasesList } from "./purchases-list";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { StatementsCard } from "./statements-card";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;
  const { user } = useCurrentUser();
  const [supplier, setSupplier] = useState<Supplier | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    return onSnapshot(
      doc(db, "suppliers", supplierId),
      (snap) => {
        setSupplier(snap.exists() ? ({ id: snap.id, ...snap.data() } as Supplier) : null);
      },
      () => setLoadError("Failed to load this supplier. Try refreshing the page.")
    );
  }, [supplierId, user]);

  async function toggleActive() {
    if (!supplier) return;
    const db = getFirebaseDb();
    await updateDoc(doc(db, "suppliers", supplier.id), {
      active: !supplier.active,
      updatedAt: new Date().toISOString(),
    });
  }

  if (loadError) {
    return <p className="text-destructive">{loadError}</p>;
  }

  if (supplier === undefined) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (supplier === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">Supplier not found.</p>
        <Link href="/dashboard/suppliers" className="text-sm text-primary hover:underline">
          Back to suppliers
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/suppliers"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to suppliers
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-foreground">{supplier.name}</h1>
            <Badge variant={supplier.active ? "default" : "secondary"}>
              {supplier.active ? "Active" : "Archived"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <SupplierFormDialog
              supplier={supplier}
              trigger={
                <Button variant="outline" size="sm">
                  Edit details
                </Button>
              }
            />
            <Button variant="outline" size="sm" onClick={toggleActive}>
              {supplier.active ? "Archive" : "Unarchive"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>
              <span className="text-muted-foreground">Phone: </span>
              {supplier.phone ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Address: </span>
              {supplier.address ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <CardTitle>Balance</CardTitle>
            <RecordPaymentDialog supplierId={supplier.id} />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-bold text-foreground">
              {formatAmount(supplier.balance)}
            </p>
            <p className="text-sm text-muted-foreground">
              {supplier.balance > 0
                ? "Owed to the supplier"
                : supplier.balance < 0
                  ? "Farm has credit"
                  : "Settled"}
            </p>
            <Link
              href={`/dashboard/suppliers/${supplier.id}/ledger`}
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              View full ledger
            </Link>
          </CardContent>
        </Card>
      </div>

      <OpeningBalanceCard supplierId={supplier.id} hasOpeningBalance={supplier.hasOpeningBalance} />

      <PurchasesList supplierId={supplier.id} />

      <StatementsCard supplierId={supplier.id} />
    </div>
  );
}
