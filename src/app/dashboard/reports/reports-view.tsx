"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/format-number";
import { downloadCsv } from "@/lib/csv";
import type { Customer } from "@/types/customer";
import type { Supplier } from "@/types/supplier";
import type { Employee } from "@/types/employee";

type Row = { id: string; name: string; phone: string | null; active: boolean; balance: number };

function DomainReport({
  title,
  detailBasePath,
  rows,
  balanceLabel,
  csvFileName,
}: {
  title: string;
  detailBasePath: string;
  rows: Row[];
  balanceLabel: string;
  csvFileName: string;
}) {
  const total = useMemo(() => Math.round(rows.reduce((sum, r) => sum + r.balance, 0) * 100) / 100, [rows]);
  const activeCount = rows.filter((r) => r.active).length;

  function exportCsv() {
    downloadCsv(
      csvFileName,
      ["Name", "Phone", "Status", "Balance"],
      rows.map((r) => [r.name, r.phone ?? "", r.active ? "Active" : "Archived", r.balance])
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{title} — total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold text-foreground">{formatAmount(total)}</p>
            <p className="text-sm text-muted-foreground">{balanceLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Count</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold text-foreground">{rows.length}</p>
            <p className="text-sm text-muted-foreground">{activeCount} active</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-0 pt-6">
          <div className="flex items-center justify-between px-6">
            <p className="text-sm text-muted-foreground">{rows.length} total</p>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nothing to report yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-foreground">
                        <Link href={`${detailBasePath}/${row.id}`} className="hover:underline">
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell>{row.phone ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={row.active ? "default" : "secondary"}>
                          {row.active ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatAmount(row.balance)}</TableCell>
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

export function ReportsView({
  customers,
  suppliers,
  employees,
}: {
  customers: Customer[];
  suppliers: Supplier[];
  employees: Employee[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Current balance across all three ledgers, exportable as CSV.
        </p>
      </div>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
        </TabsList>
        <TabsContent value="customers">
          <DomainReport
            title="Receivable from customers"
            detailBasePath="/dashboard/customers"
            balanceLabel="Total owed to the farm"
            csvFileName="customers-report.csv"
            rows={customers}
          />
        </TabsContent>
        <TabsContent value="suppliers">
          <DomainReport
            title="Payable to suppliers"
            detailBasePath="/dashboard/suppliers"
            balanceLabel="Total owed to suppliers"
            csvFileName="suppliers-report.csv"
            rows={suppliers}
          />
        </TabsContent>
        <TabsContent value="employees">
          <DomainReport
            title="Owed to employees"
            detailBasePath="/dashboard/employees"
            balanceLabel="Net salary owed (advances reduce this)"
            csvFileName="employees-report.csv"
            rows={employees}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
