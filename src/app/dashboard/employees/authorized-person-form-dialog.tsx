"use client";

import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AuthorizedPerson } from "@/types/employee";

type AuthorizedPersonFormDialogProps = {
  person?: AuthorizedPerson;
  trigger: React.ReactElement;
};

export function AuthorizedPersonFormDialog({ person, trigger }: AuthorizedPersonFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(person?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(person?.name ?? "");
      setError(null);
    }
  }, [open, person]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const now = new Date().toISOString();
      if (person) {
        await updateDoc(doc(db, "authorizedPeople", person.id), {
          name: name.trim(),
          updatedAt: now,
        });
      } else {
        await addDoc(collection(db, "authorizedPeople"), {
          name: name.trim(),
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      setOpen(false);
    } catch {
      setError("Failed to save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{person ? "Edit person" : "Add authorized person"}</DialogTitle>
          <DialogDescription>
            {person
              ? "Update this person's name."
              : "People who can hand out an advance/payment — appears as a \"Given by\" option on that form."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="authorized-person-name">Name</Label>
            <Input
              id="authorized-person-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {person ? "Save changes" : "Add person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
