import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { animalCategories, animals } from "./schema";
import type { LivestockSummary } from "@/types/livestock";

/**
 * Active-animal counts rolled up by the category's topLevelGroup — feeds
 * both the dashboard's livestock section and the landing page's public
 * "Our Herd" section. No auth check here (unlike every other db/*.ts
 * query in this app) — this is deliberately safe to call from the public
 * landing page too, since it only ever returns aggregate counts, nothing
 * per-animal.
 */
export async function getLivestockSummary(): Promise<LivestockSummary> {
  const rows = await getDb()
    .select({
      topLevelGroup: animalCategories.topLevelGroup,
      count: sql<string>`count(*)`,
    })
    .from(animals)
    .innerJoin(animalCategories, eq(animals.categoryId, animalCategories.id))
    .where(eq(animals.status, "active"))
    .groupBy(animalCategories.topLevelGroup);

  const summary: LivestockSummary = { buffalo: 0, cow: 0, calf: 0, other: 0, total: 0 };
  for (const row of rows) {
    const count = Number(row.count);
    summary[row.topLevelGroup] = count;
    summary.total += count;
  }
  return summary;
}
