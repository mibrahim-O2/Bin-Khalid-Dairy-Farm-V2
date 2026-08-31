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
import type { Employee } from "@/types/employee";
import { formatAmount } from "@/lib/format-number";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { AuthorizedPeopleCard } from "./authorized-people-card";

export default function EmployeesPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const q = query(collection(db, "employees"), orderBy("name"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setEmployees(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Employee));
      },
      () => setError("Failed to load employees. Check your connection.")
    );
    return unsubscribe;
  }, [user]);

  const filtered = useMemo(() => {
    if (!employees) return null;
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (e) => e.name.toLowerCase().includes(term) || (e.phone ?? "").toLowerCase().includes(term)
    );
  }, [employees, search]);

  async function toggleActive(employee: Employee) {
    const db = getFirebaseDb();
    await updateDoc(doc(db, "employees", employee.id), {
      active: !employee.active,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {employees ? `${employees.length} total` : "Loading…"}
          </p>
        </div>
        <EmployeeFormDialog
          trigger={<Button>Add employee</Button>}
          onCreated={(id) => router.push(`/dashboard/employees/${id}`)}
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
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium text-foreground">
                        <Link href={`/dashboard/employees/${employee.id}`} className="hover:underline">
                          {employee.name}
                        </Link>
                      </TableCell>
                      <TableCell>{employee.phone ?? "—"}</TableCell>
                      <TableCell
                        className={
                          // Reversed vs customers/suppliers (Domain C): a
                          // positive balance means the farm still owes this
                          // employee salary — the normal, neutral case, not
                          // a "good" surprise. A negative balance means
                          // they've drawn more in advances than they've
                          // earned — good for the farm's cash position,
                          // same as a customer/supplier credit balance.
                          employee.balance < 0
                            ? "text-success"
                            : employee.balance > 0
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }
                      >
                        {formatAmount(employee.balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.active ? "default" : "secondary"}>
                          {employee.active ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => toggleActive(employee)}>
                          {employee.active ? "Archive" : "Unarchive"}
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

      <AuthorizedPeopleCard />
    </div>
  );
}
