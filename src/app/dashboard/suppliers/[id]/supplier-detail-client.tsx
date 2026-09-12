"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Supplier, SupplierLedgerTransaction } from "@/types/supplier";
import type { Purchase } from "@/types/purchase";
import type { SupplierStatement } from "@/types/supplier-statement";
import type { BusinessSettings, InvoiceSettings } from "@/types/settings";
import { formatAmount } from "@/lib/format-number";
import { SupplierFormDialog } from "../supplier-form-dialog";
import { setSupplierActive } from "../crud-actions";
import { OpeningBalanceCard } from "./opening-balance-card";
import { PurchasesList } from "./purchases-list";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { StatementsCard } from "./statements-card";
import { DeleteSupplierDialog } from "./delete-supplier-dialog";

export function SupplierDetailClient({
  isOwner,
  supplier,
  purchases,
  openingBalanceEntry,
  statements,
  businessInfo,
  invoiceSettings,
}: {
  isOwner: boolean;
  supplier: Supplier | null;
  purchases: Purchase[];
  openingBalanceEntry: SupplierLedgerTransaction | null;
  statements: SupplierStatement[];
  businessInfo: BusinessSettings;
  invoiceSettings: InvoiceSettings;
}) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);

  async function toggleActive() {
    if (!supplier) return;
    setToggling(true);
    await setSupplierActive({ supplierId: supplier.id, active: !supplier.active });
    setToggling(false);
    router.refresh();
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
            <Button variant="outline" size="sm" disabled={toggling} onClick={toggleActive}>
              {supplier.active ? "Archive" : "Unarchive"}
            </Button>
            {isOwner ? <DeleteSupplierDialog supplierId={supplier.id} supplierName={supplier.name} /> : null}
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

      <OpeningBalanceCard
        supplierId={supplier.id}
        hasOpeningBalance={supplier.hasOpeningBalance}
        entry={openingBalanceEntry}
      />

      <PurchasesList
        supplierId={supplier.id}
        supplier={supplier}
        purchases={purchases}
        businessInfo={businessInfo}
        invoiceSettings={invoiceSettings}
      />

      <StatementsCard supplierId={supplier.id} statements={statements} />
    </div>
  );
}
