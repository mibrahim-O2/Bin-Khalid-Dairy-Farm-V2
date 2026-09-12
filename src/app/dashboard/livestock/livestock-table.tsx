"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format-date";
import { formatAmount } from "@/lib/format-number";
import type { Animal, AnimalCategory, AnimalGender, AnimalStatus } from "@/types/livestock";
import {
  createAnimal,
  deleteAnimal,
  reactivateAnimal,
  recordAnimalDeath,
  recordAnimalSale,
  updateAnimalDetails,
} from "./actions";

const genderLabels: Record<AnimalGender, string> = { male: "Male", female: "Female" };

const statusVariant: Record<AnimalStatus, "default" | "secondary" | "destructive"> = {
  active: "default",
  sold: "secondary",
  deceased: "destructive",
};
const statusClassName: Record<AnimalStatus, string> = {
  active: "border-transparent bg-success text-success-foreground",
  sold: "",
  deceased: "",
};
const statusLabel: Record<AnimalStatus, string> = { active: "Active", sold: "Sold", deceased: "Deceased" };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function AnimalFormFields({
  categories,
  categoryId,
  setCategoryId,
  name,
  setName,
  gender,
  setGender,
  acquisitionDate,
  setAcquisitionDate,
  note,
  setNote,
}: {
  categories: AnimalCategory[];
  categoryId: string;
  setCategoryId: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  gender: AnimalGender;
  setGender: (v: AnimalGender) => void;
  acquisitionDate: string;
  setAcquisitionDate: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
}) {
  const activeCategories = categories.filter((c) => c.active || c.id === categoryId);
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="animal-category">Category</Label>
        <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
          <SelectTrigger id="animal-category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {activeCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="animal-name">Name/label (optional)</Label>
          <Input id="animal-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Moti" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="animal-gender">Gender</Label>
          <Select value={gender} onValueChange={(v) => v && setGender(v as AnimalGender)}>
            <SelectTrigger id="animal-gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="animal-acquisition-date">Acquisition date</Label>
        <Input
          id="animal-acquisition-date"
          type="date"
          value={acquisitionDate}
          onChange={(e) => setAcquisitionDate(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="animal-note">Note (optional)</Label>
        <Textarea id="animal-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
    </>
  );
}

/** Any active admin. */
function AddAnimalDialog({ categories }: { categories: AnimalCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<AnimalGender>("female");
  const [acquisitionDate, setAcquisitionDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCategoryId(categories.find((c) => c.active)?.id ?? "");
      setName("");
      setGender("female");
      setAcquisitionDate(todayIso());
      setNote("");
      setError(null);
    }
  }, [open, categories]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!categoryId) {
      setError("Select a category.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createAnimal({
      categoryId,
      name: name.trim() || undefined,
      gender,
      acquisitionDate,
      note: note.trim() || undefined,
    });
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
      <DialogTrigger render={<Button size="sm">Add animal</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an animal</DialogTitle>
          <DialogDescription>Any active admin can add a record.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <AnimalFormFields
            categories={categories}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            name={name}
            setName={setName}
            gender={gender}
            setGender={setGender}
            acquisitionDate={acquisitionDate}
            setAcquisitionDate={setAcquisitionDate}
            note={note}
            setNote={setNote}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Add animal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Owner-only. */
function EditAnimalDialog({ animal, categories }: { animal: Animal; categories: AnimalCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(animal.categoryId);
  const [name, setName] = useState(animal.name ?? "");
  const [gender, setGender] = useState<AnimalGender>(animal.gender);
  const [acquisitionDate, setAcquisitionDate] = useState(animal.acquisitionDate);
  const [note, setNote] = useState(animal.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCategoryId(animal.categoryId);
      setName(animal.name ?? "");
      setGender(animal.gender);
      setAcquisitionDate(animal.acquisitionDate);
      setNote(animal.note ?? "");
      setError(null);
    }
  }, [open, animal]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await updateAnimalDetails({
      animalId: animal.id,
      categoryId,
      name: name.trim() || undefined,
      gender,
      acquisitionDate,
      note: note.trim() || undefined,
    });
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
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit animal details</DialogTitle>
          <DialogDescription>Owner-only — everyone else sees this record read-only.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <AnimalFormFields
            categories={categories}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            name={name}
            setName={setName}
            gender={gender}
            setGender={setGender}
            acquisitionDate={acquisitionDate}
            setAcquisitionDate={setAcquisitionDate}
            note={note}
            setNote={setNote}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Owner-only. */
function RecordSaleDialog({ animal }: { animal: Animal }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saleDate, setSaleDate] = useState(todayIso());
  const [salePrice, setSalePrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedPrice = Number(salePrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Enter a valid, non-negative sale price.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await recordAnimalSale({ animalId: animal.id, saleDate, salePrice: parsedPrice });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSaleDate(todayIso());
          setSalePrice("");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Record sale</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record sale — {animal.name || "this animal"}</DialogTitle>
          <DialogDescription>Marks the animal Sold. Owner-only.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-date">Sale date</Label>
            <Input id="sale-date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sale-price">Sale price</Label>
            <Input
              id="sale-price"
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Owner-only. */
function RecordDeathDialog({ animal }: { animal: Animal }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deceasedDate, setDeceasedDate] = useState(todayIso());
  const [deceasedNote, setDeceasedNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await recordAnimalDeath({
      animalId: animal.id,
      deceasedDate,
      deceasedNote: deceasedNote.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDeceasedDate(todayIso());
          setDeceasedNote("");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Record death</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record death — {animal.name || "this animal"}</DialogTitle>
          <DialogDescription>Marks the animal Deceased. Owner-only.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="deceased-date">Date</Label>
            <Input
              id="deceased-date"
              type="date"
              value={deceasedDate}
              onChange={(e) => setDeceasedDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="deceased-note">Cause/circumstances (optional)</Label>
            <Textarea
              id="deceased-note"
              value={deceasedNote}
              onChange={(e) => setDeceasedNote(e.target.value)}
              rows={2}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Owner-only. */
function DeleteAnimalDialog({ animal, onDeleted }: { animal: Animal; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    const result = await deleteAnimal({ animalId: animal.id });
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    onDeleted();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
      <DialogTrigger render={<Button variant="destructive" size="sm">Delete</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete this record?</DialogTitle>
          <DialogDescription>This cannot be undone. Owner-only.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="destructive" disabled={deleting} onClick={handleConfirm}>
            Yes, delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Owner-only — a one-click correction, same convention as Archive/Unarchive toggles elsewhere. */
function ReactivateButton({ animal }: { animal: Animal }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await reactivateAnimal({ animalId: animal.id });
    setPending(false);
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={handleClick}>
      Reactivate
    </Button>
  );
}

function AnimalActions({
  animal,
  categories,
  isOwner,
  onDeleted,
}: {
  animal: Animal;
  categories: AnimalCategory[];
  isOwner: boolean;
  onDeleted: () => void;
}) {
  if (!isOwner) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <EditAnimalDialog animal={animal} categories={categories} />
      {animal.status === "active" ? (
        <>
          <RecordSaleDialog animal={animal} />
          <RecordDeathDialog animal={animal} />
        </>
      ) : (
        <ReactivateButton animal={animal} />
      )}
      <DeleteAnimalDialog animal={animal} onDeleted={onDeleted} />
    </div>
  );
}

function animalStatusNote(animal: Animal): string | null {
  if (animal.status === "sold") {
    return `Sold ${formatDate(animal.saleDate!)}${animal.salePrice !== null ? ` for ${formatAmount(animal.salePrice)}` : ""}`;
  }
  if (animal.status === "deceased") {
    return `Deceased ${formatDate(animal.deceasedDate!)}${animal.deceasedNote ? ` — ${animal.deceasedNote}` : ""}`;
  }
  return null;
}

export function LivestockTable({
  categories,
  animals,
  isOwner,
}: {
  categories: AnimalCategory[];
  animals: Animal[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const counts = animals.reduce(
    (acc, a) => {
      acc[a.status] += 1;
      return acc;
    },
    { active: 0, sold: 0, deceased: 0 } as Record<AnimalStatus, number>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle>Animals</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{counts.active} active</span>
            <span>&middot;</span>
            <span>{counts.sold} sold</span>
            <span>&middot;</span>
            <span>{counts.deceased} deceased</span>
          </div>
        </div>
        <AddAnimalDialog categories={categories} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-0 pt-0">
        {/* Desktop: real table. Mobile: one card per animal — a table this
            wide (7+ columns) simply can't fit a 390px screen without
            squeezing unreadable columns, so it gets the same card-list
            treatment as every other table-heavy view revisited this pass. */}
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Acquired</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {animals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No animals recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                animals.map((animal) => {
                  const statusNote = animalStatusNote(animal);
                  return (
                    <TableRow key={animal.id}>
                      <TableCell className="font-medium text-foreground">{animal.name || "—"}</TableCell>
                      <TableCell>{animal.categoryName}</TableCell>
                      <TableCell>{genderLabels[animal.gender]}</TableCell>
                      <TableCell>{formatDate(animal.acquisitionDate)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={statusVariant[animal.status]} className={statusClassName[animal.status]}>
                            {statusLabel[animal.status]}
                          </Badge>
                          {statusNote ? <span className="text-xs text-muted-foreground">{statusNote}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <AnimalActions
                          animal={animal}
                          categories={categories}
                          isOwner={isOwner}
                          onDeleted={() => router.refresh()}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 px-4 pb-4 md:hidden">
          {animals.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No animals recorded yet.</p>
          ) : (
            animals.map((animal) => {
              const statusNote = animalStatusNote(animal);
              return (
                <div key={animal.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{animal.name || animal.categoryName}</p>
                      <p className="text-sm text-muted-foreground">
                        {animal.categoryName} &middot; {genderLabels[animal.gender]}
                      </p>
                    </div>
                    <Badge variant={statusVariant[animal.status]} className={statusClassName[animal.status]}>
                      {statusLabel[animal.status]}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Acquired {formatDate(animal.acquisitionDate)}</p>
                    {statusNote ? <p>{statusNote}</p> : null}
                    {animal.note ? <p className="mt-1">{animal.note}</p> : null}
                  </div>
                  <AnimalActions
                    animal={animal}
                    categories={categories}
                    isOwner={isOwner}
                    onDeleted={() => router.refresh()}
                  />
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
