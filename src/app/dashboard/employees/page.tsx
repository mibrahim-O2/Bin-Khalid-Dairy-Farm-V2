import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { authorizedPeople as authorizedPeopleTable, employees as employeesTable } from "@/lib/db/schema";
import { toAuthorizedPerson, toEmployee } from "@/lib/db/mappers";
import { EmployeesTable } from "./employees-table";
import { AuthorizedPeopleCard } from "./authorized-people-card";

// Server Component — one-time fetch at request time, no client-side
// onSnapshot listener (see src/lib/db/README.md).
export default async function EmployeesPage() {
  const db = getDb();
  const [employeeRows, personRows] = await Promise.all([
    db.select().from(employeesTable).orderBy(asc(employeesTable.name)),
    db.select().from(authorizedPeopleTable).orderBy(asc(authorizedPeopleTable.name)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <EmployeesTable employees={employeeRows.map(toEmployee)} />
      <AuthorizedPeopleCard people={personRows.map(toAuthorizedPerson)} />
    </div>
  );
}
