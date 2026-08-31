"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
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
import type { Customer } from "@/types/customer";
import { formatAmount } from "@/lib/format-number";
import { CustomerFormDialog } from "./customer-form-dialog";

export default function CustomersPage() {
  const router = useRouter();
  // Wait for the Firebase client SDK's own auth state — otherwise this can
  // lose a race against auth rehydration on a fresh page load and fail with
  // permission-denied.
  const { user } = useCurrentUser();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const q = query(collection(db, "customers"), orderBy("name"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCustomers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Customer));
      },
      () => setError("Failed to load customers. Check your connection.")
    );
    return unsubscribe;
  }, [user]);

  const filtered = useMemo(() => {
    if (!customers) return null;
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.phone ?? "").toLowerCase().includes(term)
    );
  }, [customers, search]);

  async function toggleActive(customer: Customer) {
    const db = getFirebaseDb();
    await updateDoc(doc(db, "customers", customer.id), {
      active: !customer.active,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {customers ? `${customers.length} total` : "Loading…"}
          </p>
        </div>
        <CustomerFormDialog
          trigger={<Button>Add customer</Button>}
          onCreated={(id) => router.push(`/dashboard/customers/${id}`)}
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
                {filtered === null ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium text-foreground">
                        <Link href={`/dashboard/customers/${customer.id}`} className="hover:underline">
                          {customer.name}
                        </Link>
                      </TableCell>
                      <TableCell>{customer.phone ?? "—"}</TableCell>
                      <TableCell
                        className={
                          customer.balance > 0
                            ? "text-foreground"
                            : customer.balance < 0
                              ? "text-success"
                              : "text-muted-foreground"
                        }
                      >
                        {formatAmount(customer.balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.active ? "default" : "secondary"}>
                          {customer.active ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => toggleActive(customer)}>
                          {customer.active ? "Archive" : "Unarchive"}
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
