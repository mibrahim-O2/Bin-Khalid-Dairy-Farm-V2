import { asc, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth/session";
import { isOwnerSession } from "@/lib/auth/owner";
import { animalCategories, animals } from "@/lib/db/schema";
import { toAnimal, toAnimalCategory } from "@/lib/db/mappers";
import { LivestockTable } from "./livestock-table";
import { AnimalCategoryManager } from "./animal-category-manager";

export default async function LivestockPage() {
  const db = getDb();
  const session = await getServerSession();
  const isOwner = session ? isOwnerSession(session) : false;

  const [categoryRows, animalRows] = await Promise.all([
    db.select().from(animalCategories).orderBy(asc(animalCategories.name)),
    db.select().from(animals).orderBy(desc(animals.acquisitionDate)),
  ]);

  const categoriesById = new Map(categoryRows.map((row) => [row.id, row]));
  const categories = categoryRows.map(toAnimalCategory);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Livestock</h1>
        <p className="text-sm text-muted-foreground">
          The farm&apos;s animals — for reference only, never tied to billing or the ledger.
        </p>
      </div>

      <LivestockTable
        categories={categories}
        animals={animalRows.flatMap((row) => {
          const category = categoriesById.get(row.categoryId);
          // Defensive only — categoryId is a NOT NULL FK, so this should
          // never actually be missing.
          return category ? [toAnimal(row, category)] : [];
        })}
        isOwner={isOwner}
      />

      <AnimalCategoryManager categories={categories} />
    </div>
  );
}
