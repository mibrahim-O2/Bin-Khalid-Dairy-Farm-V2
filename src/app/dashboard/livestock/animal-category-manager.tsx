"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { AnimalCategory, AnimalTopLevelGroup } from "@/types/livestock";
import { createAnimalCategory, deleteAnimalCategory, setAnimalCategoryActive, updateAnimalCategory } from "./actions";

const groupLabels: Record<AnimalTopLevelGroup, string> = {
  buffalo: "Buffalo",
  cow: "Cow",
  calf: "Calf",
  other: "Other",
};

/**
 * Admin-managed reference list, same trust level as Farm Supply
 * Items/Products — any active admin can add/edit/archive/delete a
 * category (not Owner-gated; only animal RECORDS carry that restriction).
 */
function CategoryFormDialog({
  category,
  trigger,
}: {
  category?: AnimalCategory;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [topLevelGroup, setTopLevelGroup] = useState<AnimalTopLevelGroup>(category?.topLevelGroup ?? "other");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setTopLevelGroup(category?.topLevelGroup ?? "other");
      setError(null);
    }
  }, [open, category]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = category
      ? await updateAnimalCategory({ categoryId: category.id, name, topLevelGroup })
      : await createAnimalCategory({ name, topLevelGroup });
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
          <DialogTitle>{category ? "Edit category" : "Add animal category"}</DialogTitle>
          <DialogDescription>
            {category
              ? "Update this category's name or group."
              : "For a type not covered by the 8 core categories — e.g. Goat, Sheep."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-group">Group (drives the dashboard icon)</Label>
            <Select value={topLevelGroup} onValueChange={(value) => setTopLevelGroup(value as AnimalTopLevelGroup)}>
              <SelectTrigger id="category-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(groupLabels) as AnimalTopLevelGroup[]).map((group) => (
                  <SelectItem key={group} value={group}>
                    {groupLabels[group]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {category ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryDialog({ category, onDeleted }: { category: AnimalCategory; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    const result = await deleteAnimalCategory({ categoryId: category.id });
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
          <DialogTitle>Delete {category.name}?</DialogTitle>
          <DialogDescription>
            This permanently removes the category. It only succeeds if no animal is recorded
            against it — if one is, archive it instead.
          </DialogDescription>
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

export function AnimalCategoryManager({ categories }: { categories: AnimalCategory[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(category: AnimalCategory) {
    setPendingId(category.id);
    setError(null);
    const result = await setAnimalCategoryActive({ categoryId: category.id, active: !category.active });
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
        <CardTitle>Animal categories</CardTitle>
        <CategoryFormDialog trigger={<Button size="sm">Add category</Button>} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-0 pt-0">
        {error ? <p className="px-4 text-sm text-destructive sm:px-6">{error}</p> : null}

        {/* Desktop: table. Mobile: stacked cards — see livestock-table.tsx
            for the same dual-layout pattern used for the animal list. */}
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No categories yet.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium text-foreground">{category.name}</TableCell>
                    <TableCell>{groupLabels[category.topLevelGroup]}</TableCell>
                    <TableCell>
                      <Badge variant={category.active ? "default" : "secondary"}>
                        {category.active ? "Active" : "Archived"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex justify-end gap-2 text-right">
                      <CategoryFormDialog
                        category={category}
                        trigger={<Button variant="outline" size="sm">Edit</Button>}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === category.id}
                        onClick={() => toggleActive(category)}
                      >
                        {category.active ? "Archive" : "Unarchive"}
                      </Button>
                      <DeleteCategoryDialog category={category} onDeleted={() => router.refresh()} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 px-4 pb-4 md:hidden">
          {categories.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{category.name}</p>
                    <p className="text-sm text-muted-foreground">{groupLabels[category.topLevelGroup]}</p>
                  </div>
                  <Badge variant={category.active ? "default" : "secondary"}>
                    {category.active ? "Active" : "Archived"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CategoryFormDialog
                    category={category}
                    trigger={<Button variant="outline" size="sm">Edit</Button>}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId === category.id}
                    onClick={() => toggleActive(category)}
                  >
                    {category.active ? "Archive" : "Unarchive"}
                  </Button>
                  <DeleteCategoryDialog category={category} onDeleted={() => router.refresh()} />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
