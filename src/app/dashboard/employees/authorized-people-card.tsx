"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
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

/**
 * "Given by" on an advance/payment form comes from this farm-managed list,
 * not a hardcoded set of names (PHASES.md Phase 7). This lives on the
 * Employees page for now since that's the only place it's consumed —
 * Settings (Phase 9) can surface/link to it later without moving the data.
 */
export function AuthorizedPeopleCard() {
  const { user } = useCurrentUser();
  const [people, setPeople] = useState<AuthorizedPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const q = query(collection(db, "authorizedPeople"), orderBy("name"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPeople(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AuthorizedPerson));
      },
      () => setError("Failed to load authorized people. Check your connection.")
    );
    return unsubscribe;
  }, [user]);

  async function toggleActive(person: AuthorizedPerson) {
    const db = getFirebaseDb();
    await updateDoc(doc(db, "authorizedPeople", person.id), {
      active: !person.active,
      updatedAt: new Date().toISOString(),
    });
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
              {people === null ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : people.length === 0 ? (
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
                      <Button variant="outline" size="sm" onClick={() => toggleActive(person)}>
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
