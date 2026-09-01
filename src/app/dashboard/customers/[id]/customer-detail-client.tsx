"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Customer, CustomerRate, Product } from "@/types/customer";
import { formatAmount } from "@/lib/format-number";
import { CustomerFormDialog } from "../customer-form-dialog";
import { setCustomerActive } from "../crud-actions";
import { RateManager } from "./rate-manager";
import { OpeningBalanceCard } from "./opening-balance-card";
import { BillsList } from "./bills-list";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { DeleteCustomerDialog } from "./delete-customer-dialog";

export function CustomerDetailClient({
  isOwner,
  customer,
  products,
  rates,
}: {
  isOwner: boolean;
  customer: Customer | null;
  products: Product[];
  rates: CustomerRate[];
}) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);

  async function toggleActive() {
    if (!customer) return;
    setToggling(true);
    await setCustomerActive({ customerId: customer.id, active: !customer.active });
    setToggling(false);
    router.refresh();
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
            <Button variant="outline" size="sm" disabled={toggling} onClick={toggleActive}>
              {customer.active ? "Archive" : "Unarchive"}
            </Button>
            {isOwner ? (
              <DeleteCustomerDialog customerId={customer.id} customerName={customer.name} />
            ) : null}
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
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <CardTitle>Balance</CardTitle>
            <RecordPaymentDialog customerId={customer.id} />
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
            <Link
              href={`/dashboard/customers/${customer.id}/ledger`}
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              View full ledger
            </Link>
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
          <RateManager customerId={customer.id} products={products} rates={rates} />
        </CardContent>
      </Card>
    </div>
  );
}
