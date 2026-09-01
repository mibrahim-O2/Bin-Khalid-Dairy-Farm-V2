"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuthorizedPerson } from "@/types/employee";
import { AuthorizedPersonFormDialog } from "./authorized-person-form-dialog";
import { setAuthorizedPersonActive } from "./authorized-people-actions";

/**
 * "Given by" on an advance/payment form comes from this farm-managed list,
 * not a hardcoded set of names (PHASES.md Phase 7). This lives on the
 * Employees page for now since that's the only place it's consumed —
 * Settings (Phase 9) can surface/link to it later without moving the data.
 */
export function AuthorizedPeopleCard({ people }: { people: AuthorizedPerson[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(person: AuthorizedPerson) {
    setPendingId(person.id);
    setError(null);
    const result = await setAuthorizedPersonActive({ personId: person.id, active: !person.active });
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Authorized people</CardTitle>
        <AuthorizedPersonFormDialog trigger={<Button size="sm">Add person</Button>} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Who can be recorded as having given an advance/payment.
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No one added yet.
                  </TableCell>
                </TableRow>
              ) : (
                people.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium text-foreground">{person.name}</TableCell>
                    <TableCell>
                      <Badge variant={person.active ? "default" : "secondary"}>
                        {person.active ? "Active" : "Archived"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex justify-end gap-2 text-right">
                      <AuthorizedPersonFormDialog
                        person={person}
                        trigger={
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === person.id}
                        onClick={() => toggleActive(person)}
                      >
                        {person.active ? "Archive" : "Unarchive"}
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
  );
}
