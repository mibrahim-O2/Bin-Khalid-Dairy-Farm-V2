"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
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
import { formatAmount } from "@/lib/format-number";
import { formatDate } from "@/lib/format-date";
import type { Bill, BillStatus } from "@/types/bill";

const statusVariant: Record<BillStatus, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  finalized: "default",
  void: "destructive",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export function BillsList({ customerId }: { customerId: string }) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const db = getFirebaseDb();
    const q = query(
      collection(db, "bills"),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snapshot) => {
      setBills(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Bill));
    });
  }, [customerId]);

  async function handleNewBill() {
    if (!user) return;
    setCreating(true);
    try {
      const db = getFirebaseDb();
      const now = new Date().toISOString();
      const ref = await addDoc(collection(db, "bills"), {
        customerId,
        billNumber: null,
        status: "draft",
        startDate: firstOfMonthIso(),
        endDate: todayIso(),
        days: 0,
        lineItems: [],
        subtotal: 0,
        previousBalance: null,
        totalPayable: null,
        note: null,
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid,
        finalizedAt: null,
        finalizedBy: null,
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
        replacesBillId: null,
        replacedByBillId: null,
      });
      router.push(`/dashboard/customers/${customerId}/bills/${ref.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">Bills</h2>
          <Button size="sm" disabled={creating || !user} onClick={handleNewBill}>
            New bill
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills === null ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : bills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No bills yet.
                  </TableCell>
                </TableRow>
              ) : (
                bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link
                        href={`/dashboard/customers/${customerId}/bills/${bill.id}`}
                        className="hover:underline"
                      >
                        {bill.billNumber ?? "Draft"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatDate(bill.startDate)} – {formatDate(bill.endDate)}
                    </TableCell>
                    <TableCell>{formatAmount(bill.subtotal)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[bill.status]} className="capitalize">
                        {bill.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
