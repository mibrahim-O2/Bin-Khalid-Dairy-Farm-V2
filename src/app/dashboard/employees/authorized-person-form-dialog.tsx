"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import { createAuthorizedPerson, updateAuthorizedPerson } from "./authorized-people-actions";

type AuthorizedPersonFormDialogProps = {
  person?: AuthorizedPerson;
  trigger: React.ReactElement;
};

export function AuthorizedPersonFormDialog({ person, trigger }: AuthorizedPersonFormDialogProps) {
  const router = useRouter();
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
    const result = person
      ? await updateAuthorizedPerson({ personId: person.id, name })
      : await createAuthorizedPerson({ name });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
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
