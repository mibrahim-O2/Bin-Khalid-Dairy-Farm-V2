"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Customer } from "@/types/customer";
import { formatAmount } from "@/lib/format-number";
import { CustomerFormDialog } from "../customer-form-dialog";
import { RateManager } from "./rate-manager";
import { OpeningBalanceCard } from "./opening-balance-card";
import { BillsList } from "./bills-list";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);

  useEffect(() => {
    const db = getFirebaseDb();
    return onSnapshot(doc(db, "customers", customerId), (snap) => {
      setCustomer(snap.exists() ? ({ id: snap.id, ...snap.data() } as Customer) : null);
    });
  }, [customerId]);

  async function toggleActive() {
    if (!customer) return;
    const db = getFirebaseDb();
    await updateDoc(doc(db, "customers", customer.id), {
      active: !customer.active,
      updatedAt: new Date().toISOString(),
    });
  }

  if (customer === undefined) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (customer === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">Customer not found.</p>
        <Link href="/dashboard/customers" className="text-sm text-primary hover:underline">
          Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/customers"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to customers
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-foreground">{customer.name}</h1>
            <Badge variant={customer.active ? "default" : "secondary"}>
              {customer.active ? "Active" : "Archived"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <CustomerFormDialog
              customer={customer}
              trigger={
                <Button variant="outline" size="sm">
                  Edit details
                </Button>
              }
            />
            <Button variant="outline" size="sm" onClick={toggleActive}>
              {customer.active ? "Archive" : "Unarchive"}
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
              {customer.phone ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Address: </span>
              {customer.address ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-bold text-foreground">
              {formatAmount(customer.balance)}
            </p>
            <p className="text-sm text-muted-foreground">
              {customer.balance > 0
                ? "Owed to the farm"
                : customer.balance < 0
                  ? "Customer has credit"
                  : "Settled"}
            </p>
          </CardContent>
        </Card>
      </div>

      <OpeningBalanceCard customerId={customer.id} hasOpeningBalance={customer.hasOpeningBalance} />

      <BillsList customerId={customer.id} />

      <Card>
        <CardHeader>
          <CardTitle>Product rates</CardTitle>
        </CardHeader>
        <CardContent>
          <RateManager customerId={customer.id} />
        </CardContent>
      </Card>
    </div>
  );
}
